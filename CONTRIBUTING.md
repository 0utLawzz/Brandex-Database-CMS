> Current requirements and verification limits: [Project Truth](docs/PROJECT_TRUTH.md), [canonical workflow](docs/WORKFLOW_BUSINESS_RULES.md), and [Progress](Progress.md). Admin + Viewer is intended; existing Editor permissions are active compatibility debt, not the target model.

# Contributing to Brandex Datasheet

Thank you for your interest in contributing to Brandex Datasheet. This document provides clear guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js 20 or later
- pnpm package manager
- Git
- A GitHub account

### Setup

1. Fork the repository on GitHub.
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/Brandex-Database-CMS.git
cd Brandex-Database-CMS
```

3. Install dependencies:

```bash
pnpm install --frozen-lockfile
```

4. Copy the environment example and set browser-safe values:

```bash
cp .env.example .env
```

Edit `.env` and add only:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

5. Create a branch for your changes:

```bash
git checkout -b feature/your-feature-name
```

## Development Workflow

### Running the Project

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

The main application lives in `artifacts/tm-tracker`. All development commands are defined at the workspace root and filter to this package.

### Making Changes

1. Follow the existing code patterns and the rules in `AGENTS.md` and `DEV_NOTES.md`.
2. Preserve legal identifiers exactly: `type`, `client_code`, `case_number`, and `tm_cpr_number`.
3. Use server-side filtering and pagination. Never download the full trademark table for list or dashboard screens.
4. Keep Supabase as the source of truth. Google Sheets is only an asynchronous mirror.
5. Test your changes thoroughly.
6. Ensure `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
7. Commit with a clear, descriptive message.

### Commit Guidelines

- Use clear, descriptive commit messages.
- Prefer the format: `[Type] Brief description` (for example `[Fix] Correct list column selection`).
- Keep the first line under 72 characters.
- Add a detailed description after a blank line when needed.

## Pull Request Process

1. Ensure your code is properly formatted and passes all checks.
2. Update documentation if the change affects setup, architecture, or behaviour.
3. Write a clear description of your changes in the pull request.
4. Reference any related issues.
5. Wait for code review and address feedback.

### PR Checklist

- [ ] Code follows project style guidelines and `AGENTS.md`
- [ ] Changes are tested locally
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] Tests pass (`pnpm test`)
- [ ] Production build succeeds (`pnpm build`)
- [ ] Documentation is updated if needed
- [ ] Commit messages are clear and descriptive
- [ ] No service-role keys or Google Apps Script secrets appear in `VITE_*` variables or source

## Project Structure

```
Brandex-Database-CMS/
├── artifacts/
│   └── tm-tracker/          # React + Vite staff UI (primary application)
├── supabase/
│   ├── migrations/          # Authoritative database schema
│   └── functions/           # Edge Functions (Sheet sync)
├── google-apps-script/      # Mirror script for Google Sheets
├── scripts/                 # Import and utility scripts
├── .agents/                 # Skills and automation tools
├── AGENTS.md                # Project rules for contributors and agents
├── DEV_NOTES.md             # Runtime and performance contract
├── INSTALL.md               # Full installation guide
├── SECURITY.md              # Security policy
└── README.md                # Project overview
```

Do not revive the removed Express/Neon/mobile stack.

## Code Style

- Use TypeScript for type safety.
- Follow existing patterns in `artifacts/tm-tracker/src`.
- Prefer server-side filtering, pagination, and count-only queries for performance.
- Keep the brand colours (maroon `#6C1C1F`, gold `#B0740E`, cream `#F0E8D0`) consistent.
- Write clean, readable code with meaningful names.

## Testing

Before submitting a pull request, ensure:

- `pnpm typecheck` passes
- `pnpm test` passes
- `pnpm build` succeeds
- Manual testing of new features (especially role-based access and record flows)
- No console errors or warnings

## Security Rules

- The frontend may receive only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Never expose service-role keys, database passwords, or Google Apps Script secrets through `VITE_*` variables.
- Keep Row Level Security enabled on every business table.
- Do not implement bulk permanent deletion.
- Report security issues privately; do not open public issues containing credentials or client data.

## Questions or Issues?

- Check existing issues and the documentation files listed above.
- Create a new issue with detailed information when needed.
- Follow the Code of Conduct in all interactions.

## License

By contributing to Brandex Datasheet, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

Please be respectful and constructive in all interactions. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details.
