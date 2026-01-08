# Buynt Codebase Guidelines for AI Agents

## Project Overview
**Buynt** is a React + TypeScript rental marketplace app built with Vite, Tailwind CSS, and Supabase. Users list items for rent and request rentals from other users.

## Architecture & Data Flow

### Core Components
- **AuthContext** ([src/context/AuthContext.tsx](src/context/AuthContext.tsx)): Mock authentication using localStorage. Email doubles as user ID for MVP.
- **Services Layer** ([src/services/](src/services/)): All database operations handled by `itemsService` and `messagesService` via Supabase client
  - `supabaseDb.ts`: CRUD operations on items and requests tables
  - `messagesService.ts`: Conversation retrieval and message sending; filters client-side for multi-user OR queries
  - `types.ts`: Defines `Item`, `Request`, `Message`, `User` interfaces
- **Pages**: Routed via React Router (`App.tsx`). Each page controls its own data fetching and form state
- **Components**: Reusable UI primitives in `components/common/` (Button, Card, Input, Modal, Badge) with Tailwind styling

### Supabase Integration
- Public API keys are hardcoded in `supabase.ts` (acceptable for MVP/read-mostly operations)
- All queries use Supabase JS SDK `.from('table')` syntax
- Error handling: Log to console and return empty/null fallbacks silently

## Build & Development

**Key Commands:**
- `npm run dev`: Start Vite dev server with HMR
- `npm run build`: TypeScript compile + Vite bundle → `dist/`
- `npm run lint`: ESLint check (no auto-fix configured)
- `npm run preview`: Serve production build locally

**Stack:**
- React 19, TypeScript 5.9, Vite 7
- Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- React Router 7 for navigation
- date-fns for date utilities
- lucide-react for icons

## Code Patterns & Conventions

### Component Structure
All components use TypeScript React FC pattern:
```tsx
interface Props { /* ... */ }
export const ComponentName: React.FC<Props> = ({ prop }) => { /* ... */ };
```

**Button Component Pattern** ([src/components/common/Button.tsx](src/components/common/Button.tsx)):
- Accepts `variant` (primary|secondary|outline|ghost) and `size` (sm|md|lg)
- Primary = indigo-600, Secondary = pink-500
- Always compose via CSS classes, no CSS-in-JS

**Card Component** ([src/components/common/Card.tsx](src/components/common/Card.tsx)):
- Wrapper with white bg, rounded-xl shadow, slate-200 border
- Optional `onClick` handler for interactivity

### Data Fetching
- Pages call service methods directly in `useEffect` with no state wrapper
- Pattern: `const [data, setData] = useState<Type[]>([]); useEffect(() => { service.getAll().then(setData) }, [])`
- No loading spinners yet; `loading` state exists but UI not updated
- Filtering done client-side after fetch ([src/pages/Home.tsx](src/pages/Home.tsx) example: category + search term)

### Form Handling
- Single `formData` state object with all inputs ([src/pages/Publish.tsx](src/pages/Publish.tsx))
- `handleChange` updates state by field name
- Submit validates required fields, calls `itemsService.add()`, navigates on success
- Email validation not implemented; accept any input

### Authentication
- No passwords; users "log in" with email only
- `useAuth()` hook provides `user`, `isAuthenticated`, `login()`, `logout()`
- User data cached in `localStorage` as `buynt_user` JSON
- Guard protected pages by checking `useAuth().isAuthenticated` (not yet enforced)

## Integration Patterns

### Message Conversations
- Fetch messages for a product between two users via `messagesService.getConversation(productId, userId1, userId2)`
- Client-side filter ensures bidirectional message pairs; Supabase OR logic is unreliable for multi-condition queries
- Mark read status in DB; `getUnreadCount()` sums receiver's unread messages

### Item & Request Flow
- Items created via `itemsService.add()` (owner_contact = current user email)
- Requests created with status='pending'; updated to 'accepted'|'rejected' later
- No FK constraints yet; referential integrity is implicit (item_id should exist)

## File Organization
```
src/
  context/      # AuthContext only; global state via hooks
  services/     # All Supabase queries; no business logic
  pages/        # Route containers; data fetching, form state
  components/   # Pure UI; layout/ holds Layout + Header
```

## Common Pitfalls to Avoid
1. **Don't hardcode user IDs**: Use `useAuth()` for current user context
2. **Don't add new service methods without types**: Update `types.ts` first
3. **Don't call Supabase directly in components**: Route through service layer
4. **Tailwind only**: Don't use inline styles or CSS modules; use className utilities
5. **localStorage persistence**: Remember to JSON.stringify/parse User objects
