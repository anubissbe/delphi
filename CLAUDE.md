# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Delphi's Oracle is a privacy-focused AI answering engine that combines web search (via SearxNG) with LLMs to provide cited answers. It supports both local LLMs (via Ollama) and cloud providers (OpenAI, Anthropic Claude, Google Gemini, Groq).

## Common Development Commands

### Setup and Development

```bash
npm install                # Install dependencies
npm run db:migrate         # Set up SQLite database (required for first-time setup)
npm run dev                # Start development server on localhost:3000
```

### Build and Production

```bash
npm run build             # Build for production
npm start                 # Start production server
```

### Code Quality

```bash
npm run lint              # Run ESLint
npm run format:write      # Format code with Prettier (ALWAYS run before committing)
```

### Testing

```bash
npm test                  # Run all tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
npm run test:ci           # Run tests in CI mode (used in CI/CD pipelines)
```

Test files are located in `src/__tests__/` and use Jest with React Testing Library. Coverage thresholds are set at 50% for all metrics (branches, functions, lines, statements).

### Database

The database is SQLite managed by Drizzle ORM:

- **Schema**: `src/lib/db/schema.ts` (defines tables for messages, chats, and config)
- **Database file**: `data/db.sqlite` (auto-created on first run)
- **Migrations**: Generated in `drizzle/` directory
- **Migration script**: `src/lib/db/migrate.ts` (run via `npm run db:migrate`)

Key tables:

- `messages`: Stores chat messages with role (assistant/user/source), content, and sources
- `chats`: Stores chat sessions with title, focusMode, and attached files
- Config is stored in database, not environment variables

## Architecture Overview

### Tech Stack

- **Frontend**: Next.js 15 (App Router), React 18, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes, LangChain for LLM orchestration
- **Database**: SQLite with Drizzle ORM
- **Search Engine**: SearxNG (self-hosted metadata search engine)
- **AI Providers**: Support for Ollama, OpenAI, Anthropic, Google Gemini, Groq

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   │   ├── chat/         # Main chat interface
│   │   ├── search/       # Direct search API
│   │   ├── providers/    # LLM provider management
│   │   ├── images/       # Image search
│   │   ├── videos/       # Video search
│   │   └── suggestions/  # Query suggestions
│   ├── c/                # Chat pages
│   ├── discover/         # Discover feature
│   ├── library/          # Search history
│   └── settings/         # Configuration
├── components/           # React components
└── lib/                  # Backend logic
    ├── chains/           # LangChain chain definitions (image, video, suggestion agents)
    ├── prompts/          # LLM prompt templates
    ├── search/           # Search logic and focus modes (MetaSearchAgent)
    ├── db/               # Database schema and operations (Drizzle ORM)
    ├── models/           # Data models and provider implementations
    │   └── providers/    # LLM and embedding model providers (in models subdirectory)
    ├── utils/            # Utility functions
    ├── config/           # Configuration management
    ├── outputParsers/    # LangChain output parsers
    └── hooks/            # React hooks
```

### Core Concepts

#### Focus Modes

All focus modes are implemented using the `MetaSearchAgent` class in `src/lib/search/metaSearchAgent.ts`. Each mode is configured with:

- `activeEngines`: Which search engines to use (e.g., 'arxiv', 'youtube', 'reddit', 'wolframalpha')
- `queryGeneratorPrompt`: How to generate search queries
- `responsePrompt`: How to format responses
- `rerank`: Whether to re-rank results using embeddings
- `searchWeb`: Whether to search the web

Available focus modes (defined in `src/lib/search/index.ts`):

- `webSearch` - General web search
- `academicSearch` - Academic papers (arXiv, Google Scholar, PubMed)
- `writingAssistant` - No web search, direct LLM response
- `wolframAlphaSearch` - Computational queries
- `youtubeSearch` - YouTube videos
- `redditSearch` - Reddit discussions

#### Search Flow

1. User sends query to `/api/chat` endpoint
2. Chain determines if web search is needed and generates optimized query
3. If search needed: Query sent to SearxNG → Results retrieved
4. Results are embedded and re-ranked using cosine similarity against query embeddings
5. Top sources passed to response generator chain
6. LLM generates cited response, streamed to UI

#### LangChain Integration

- **Chains** (`src/lib/chains/`): Define multi-step LLM workflows
  - `imageSearchAgent.ts` - Image search logic
  - `videoSearchAgent.ts` - Video search logic
  - `suggestionGeneratorAgent.ts` - Query suggestions
- **Prompts** (`src/lib/prompts/`): Prompt templates for different tasks
  - `webSearch.ts` - Web search prompts
  - `writingAssistant.ts` - Writing assistant prompts

#### Provider System

Located in `src/lib/models/providers/`, manages:

- **Chat model providers**: OpenAI, Anthropic Claude, Ollama, Google Gemini, Groq
- **Embedding model providers**: For semantic search and result re-ranking
- **Provider configuration**: API keys and settings stored in database
- **Dynamic model selection**: Users can configure which models to use at runtime

## Key Implementation Details

### Adding a New Focus Mode

1. Create a new `MetaSearchAgent` instance in `src/lib/search/index.ts`
2. Configure with appropriate engines, prompts, and reranking settings
3. Add corresponding UI option in focus mode selector component

### Database Migrations

When modifying `src/lib/db/schema.ts`:

1. Update the schema
2. Run `npm run db:migrate` to generate migration files
3. Migrations are stored in `drizzle/` directory

### Embedding-Based Re-ranking

The system uses embedding models to improve search result relevance:

1. Documents and query are converted to embeddings
2. Cosine similarity computed between query and each result
3. Results above `rerankThreshold` are kept and sorted by similarity
4. This happens in the MetaSearchAgent before passing to response chain

### Configuration

- **Runtime config**: Managed through UI at `/settings` (first-run setup screen)
- **Storage**: Config stored in database, NOT environment variables
- **API keys**: Stored in database config table
- **SearxNG URL**: Configurable via `SEARXNG_API_URL` environment variable (default: bundled instance)
- For development setup with external SearxNG, see CONTRIBUTING.md for config.toml setup

### Streaming Architecture

The application uses streaming responses for real-time AI output:

1. **API Route**: `/api/chat` handles chat requests
2. **Response streaming**: LLM responses are streamed using Next.js streaming API
3. **Progress updates**: Frontend receives incremental updates as AI generates response
4. **Source citations**: Sources are embedded in the stream and rendered alongside response
5. **Error handling**: Stream includes error states for graceful degradation

### API Structure

Key API endpoints (all in `src/app/api/`):

- **`/api/chat`**: Main chat interface (POST) - streaming responses with focus mode
- **`/api/search`**: Direct search API without chat context
- **`/api/images`**: Image search endpoint
- **`/api/videos`**: Video search endpoint
- **`/api/suggestions`**: Query suggestion generation
- **`/api/chats`**: Chat history management (GET all, POST new)
- **`/api/chats/[id]`**: Individual chat operations (GET, DELETE)
- **`/api/providers`**: LLM provider CRUD operations
- **`/api/config`**: Runtime configuration management
- **`/api/discover`**: Discover feature content

## Docker Setup

Delphi's Oracle can run with bundled SearxNG or connect to external SearxNG:

- `Dockerfile` - Full image with bundled SearxNG
- `Dockerfile.slim` - Slim image without SearxNG (requires external instance)
- `docker-compose.yaml` - Multi-container setup

## Development Workflow

### First-Time Setup

1. Install dependencies: `npm install`
2. Set up database: `npm run db:migrate` (creates `data/db.sqlite`)
3. Start development server: `npm run dev`
4. Navigate to http://localhost:3000 and complete setup wizard
5. Configure at least one LLM provider (Ollama, OpenAI, etc.)

### Making Changes

**Before committing**:

1. Run `npm run format:write` to format code (REQUIRED)
2. Run `npm run lint` to check for linting errors
3. Run `npm test` to ensure tests pass
4. If you modified schema: run `npm run db:migrate`

**Working with database**:

- Schema changes in `src/lib/db/schema.ts` require migration
- Drizzle generates type-safe queries automatically
- Database file is in `data/db.sqlite` (not tracked in version control)
- Use `npm run db:migrate` after schema changes

**Working with focus modes**:

- All modes are MetaSearchAgent instances in `src/lib/search/index.ts`
- Each mode configures: engines, prompts, reranking, and web search
- Prompts are in `src/lib/prompts/`
- Test by selecting mode in UI and running searches

**Working with providers**:

- Provider implementations in `src/lib/models/providers/`
- Each provider must implement chat and embedding model interfaces
- Configuration stored in database config table
- Test via settings page

### Debugging

**Common issues**:

- **Build errors**: Check TypeScript errors, run `npm run lint`
- **Database errors**: Delete `data/db.sqlite` and run `npm run db:migrate`
- **Provider connection errors**: Verify API keys in settings, check provider URLs
- **Search not working**: Ensure SearxNG is accessible (bundled or external)
- **Streaming issues**: Check browser console for WebSocket/fetch errors

**Useful debugging**:

- Check logs in terminal where `npm run dev` is running
- Browser DevTools console for frontend errors
- Network tab to inspect API requests/responses
- Database: Use any SQLite viewer to inspect `data/db.sqlite`

## Important Notes

- **ALWAYS** run `npm run format:write` before committing (enforces Prettier code style)
- Database migrations required when modifying `src/lib/db/schema.ts`
- The `MetaSearchAgent` class (in `src/lib/search/metaSearchAgent.ts`) is central to ALL search functionality
- LLM citations are achieved through prompt engineering, not post-processing
- Search results are re-ranked using embeddings for better relevance (cosine similarity)
- Configuration is stored in database, NOT environment variables (except `SEARXNG_API_URL`)
- First run shows setup wizard; subsequent runs go directly to chat interface
