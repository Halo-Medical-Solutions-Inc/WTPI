# Coding Rules

## Python Backend

### Code Style & Formatting
- **Formatter**: Use Black Python code formatter
- **Type Hints**: Always use type hints including return types
- **Import Organization**: Standard library → third-party → local (with blank lines between groups)
- **Comments/Docstrings**: No comments or docstrings in codebase

### Error Handling
- Use standard Python exceptions (ValueError, TypeError, etc.)
- Always wrap external calls in try/except with specific exception types

### Async/Await Patterns
- Use async/await for all I/O operations (database, API calls)

### Database/ORM Patterns
- Use SQLAlchemy with DeclarativeBase
- Use Async SQLAlchemy (AsyncSession with asyncpg for PostgreSQL)
- Use Column-based model definitions

### Function & Class Structure
- Keep functions small and focused (single responsibility)
- Prefer classes for related functionality (service classes)
- Group related classes/functions together in files

### Dependency Injection
- Use FastAPI's dependency injection system (`Depends()`)

### Configuration Management
- Always use .env files for configuration

### File & Folder Structure
- Layer-based structure: `api/`, `models/`, `schemas/`, `services/`, `database/`, `utils/`

### Validation
- Use Pydantic models for request/response validation (in `schemas/` directory)

### Testing
- Write both unit and integration tests

### Logging
- Use print statements for debugging

### API Response Format
- Consistent JSON structure: `{success, data, message}`

### Environment & Secrets
- Store secrets in .env files (gitignored)

### Naming Conventions
- snake_case for functions/variables, PascalCase for classes
- Follow PEP 8 strictly

---

## Next.js Frontend

### Code Style & Formatting
- **Formatter**: Prettier with custom configuration:
  - No line length restriction
  - Double quotes
  - Semicolons: yes
  - Trailing commas: yes
  - Tab width: 2 spaces
  - Print width: 100

### TypeScript Usage
- Strict TypeScript everywhere (no `any`, strict mode)

### Component Structure
- One component per file
- Use shadcn/ui components only - do not create custom components
- Import from `components/ui/` (e.g., `@/components/ui/button`)
- Never create your own Button, Input, etc. - always use shadcn/ui components

### File Naming
- kebab-case for all files (e.g., `calls-table.tsx`, `create-call-dialog.tsx`)

### Folder Structure
- Type-based structure:
  - `app/` - Next.js pages/routes
  - `components/` - React components (with `ui/` subfolder for shadcn components)
  - `hooks/` - Custom React hooks
  - `lib/` - Utilities and helpers
  - `store/` - Redux state management
  - `types/` - TypeScript type definitions

### Custom Hooks
- Extract reusable logic into custom hooks
- Create hooks for complex state/effects

### State Management
- Redux Toolkit with typed hooks

### Styling Approach
- Tailwind CSS utility classes exclusively
- Use shadcn/ui components from `components/ui/` only
- No custom component creation - use shadcn/ui components

### API Calls
- Axios with custom API client wrapper (`lib/api.ts` or `lib/api-client.ts`)
- Centralize API calls in API client file
- Use interceptors for authentication tokens

### Component Pattern
- Function declarations with default exports
- No arrow function components

### Import Organization
- Three groups: standard library, third-party, local
- Alphabetize within groups

### Forms
- Use simple useState for forms (no React Hook Form)

### Error Handling & User Feedback
- Use sonner toasts for all user feedback

### Loading States
- Track loading in each Redux slice
- Show spinners during async operations

### Date & Time Formatting
- Use date-fns with timezone conversion

### Confirmation Dialogs
- Use AlertDialog for all destructive actions

### Environment Variables
- Use `.env.local` for environment variables
- Prefix client-side variables with `NEXT_PUBLIC_`

---

## General Rules

### Git Commits
- User handles git commits (not automated)

### Code Organization
- Group related functionality together
- Keep files reasonably sized (typically under 200 lines, but can go slightly over)

### Best Practices
- No comments in codebase (self-documenting code)
- Type everything explicitly
- Fail fast on errors
- Prefer explicit code over concise

