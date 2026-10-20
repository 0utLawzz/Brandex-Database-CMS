import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BATCH_SIZE = 50;
/** Jobs at or above this attempt count are treated as dead and skipped. */
const MAX_ATTEMPTS = 10;

function log(level: "info" | "warn" | "error", event: string, details: Record<string, unknown> = {}) {
  console[level](JSON.stringify({ event, ...details }));
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sheetUrl = Deno.env.get("GOOGLE_APPS_SCRIPT_URL");
  const sheetSecret = Deno.env.get("GOOGLE_APPS_SCRIPT_SECRET");
  const cronSecret = Deno.env.get("SHEET_SYNC_CRON_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !sheetUrl || !sheetSecret || !cronSecret) {
    log("error", "sheet_sync_env_incomplete");
    return Response.json({ error: "Sheet mirror environment is incomplete" }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${cronSecret}`) {
    log("warn", "sheet_sync_unauthorized_request");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  log("info", "sheet_sync_started", { batchSize: BATCH_SIZE, maxAttempts: MAX_ATTEMPTS });

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let synced = 0;
  let failed = 0;
  let dead = 0;
  let processed = 0;
  const attemptedIds: number[] = [];

  for (let i = 0; i < BATCH_SIZE; i += 1) {
    const { data: jobs, error: claimError } = await supabase.rpc("claim_sheet_sync_job", {
      p_max_attempts: MAX_ATTEMPTS,
      p_exclude_ids: attemptedIds,
    });
    if (claimError) {
      log("error", "sheet_sync_claim_failed", { error: claimError.message });
      return Response.json({ error: "Could not claim Sheet sync work" }, { status: 500 });
    }
    const job = jobs?.[0];
    if (!job) break;
    attemptedIds.push(job.id);
    processed += 1;
    const nextAttempt = job.attempt_count;
    log("info", "sheet_sync_job_started", {
      jobId: job.id,
      trademarkId: job.trademark_id,
      action: job.action,
      attempt: nextAttempt,
    });

    try {
      const response = await fetch(sheetUrl, {
        method: "POST",
        headers: { "content-type": "text/plain;charset=utf-8" },
        signal: AbortSignal.timeout(60_000),
        body: JSON.stringify({
          action: job.action === "delete" ? "mirrorDelete" : "mirrorUpsert",
          secret: sheetSecret,
          id: job.trademark_id,
          record: job.payload,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || `Sheet mirror failed with ${response.status}`);
      }

      const { data: finished, error: finishError } = await supabase.rpc("finish_sheet_sync_job", {
        p_id: job.id,
        p_claim_token: job.claim_token,
        p_success: true,
        p_error: null,
      });
      if (finishError || !finished) throw new Error("Sheet job completion lost its claim");
      synced += 1;
      log("info", "sheet_sync_job_synced", {
        jobId: job.id,
        trademarkId: job.trademark_id,
        action: job.action,
        attempt: nextAttempt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const exhausted = nextAttempt >= MAX_ATTEMPTS;
      const { data: finished, error: finishError } = await supabase.rpc("finish_sheet_sync_job", {
        p_id: job.id,
        p_claim_token: job.claim_token,
        p_success: false,
        p_error: exhausted
          ? `dead letter after ${nextAttempt} attempts: ${message}`
          : message,
      });
      if (finishError || !finished) {
        log("error", "sheet_sync_finish_failed", { jobId: job.id, error: finishError?.message ?? "Claim expired" });
        return Response.json({ error: "Could not finalize Sheet sync work" }, { status: 500 });
      }
      if (exhausted) dead += 1;
      else failed += 1;
      log(exhausted ? "error" : "warn", exhausted ? "sheet_sync_job_dead_lettered" : "sheet_sync_job_failed", {
        jobId: job.id,
        trademarkId: job.trademark_id,
        action: job.action,
        attempt: nextAttempt,
        error: message,
      });
    }
  }

  log("info", "sheet_sync_completed", {
    processed,
    synced,
    failed,
    dead,
    durationMs: Date.now() - startedAt,
  });

  return Response.json({
    processed,
    synced,
    failed,
    dead,
    maxAttempts: MAX_ATTEMPTS,
  });
});
