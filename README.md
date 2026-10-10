# Summit — AI-Powered Career Roadmapper

**Plan your career. Build your skills. Reach your goals.**

Summit is an AI-powered career roadmap web application designed to help students, fresh graduates, and aspiring professionals transform their career ambitions into structured, actionable learning plans.

Instead of navigating countless tutorials, courses, and career guides without a clear direction, users can create personalised career roadmaps, explore skill dependencies, track their progress, and receive AI-generated guidance to move towards their target roles.

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Technology Stack](#technology-stack)
- [Application Architecture](#application-architecture)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [AI Integration](#ai-integration)
- [Security and Privacy](#security-and-privacy)
- [Limitations](#limitations)
- [Future Enhancements](#future-enhancements)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Career development often involves learning multiple skills, completing projects, gaining practical experience, and preparing for interviews. However, learners frequently struggle to determine what to learn first, which skills depend on others, and how to measure their progress.

Summit addresses this challenge by providing an interactive environment where users can translate a career goal into a structured roadmap.

The application combines AI-assisted roadmap generation, visual skill mapping, progress tracking, and personalised learning advice in one platform.

### Project Objectives

- Simplify career planning through structured learning roadmaps.
- Help learners understand skill dependencies and learning sequences.
- Provide actionable milestones instead of vague career advice.
- Enable users to track completed skills and projects.
- Deliver contextual learning recommendations using AI.
- Make career preparation more organised, measurable, and accessible.

---

## Problem Statement

Students and early-career professionals often encounter the following challenges:

- **Lack of direction:** Uncertainty about the skills required for a particular career.
- **Information overload:** Difficulty choosing between numerous courses, tutorials, and resources.
- **Poor prioritisation:** Learning advanced topics before understanding their prerequisites.
- **Limited progress visibility:** No central place to track learning milestones.
- **Generic guidance:** Career advice that does not account for an individual's goals and progress.

These challenges can result in wasted time, inconsistent learning, and difficulty preparing for professional opportunities.

## Solution

Summit provides a centralised career-planning workspace where users can:

1. Define a target career or professional role.
2. Generate a structured roadmap using a configured AI provider.
3. Explore skills, projects, and milestones through an interactive visual graph.
4. Review individual roadmap nodes and their prerequisites.
5. Mark completed milestones and monitor progress.
6. Request AI-generated advice for specific learning objectives.

The objective is to turn a long-term career ambition into manageable, trackable steps.

---

## Key Features

### 1. AI-Powered Career Roadmaps

Generate career roadmaps based on a user's target role or learning objective.

Roadmaps can organise learning into phases containing skills, projects, milestones, and other career-preparation activities.

### 2. Interactive Skill Graph

Explore roadmap milestones through a visual graph.

The graph is intended to make relationships between skills and learning stages easier to understand.

### 3. Skill and Milestone Tracking

Track completed roadmap activities and monitor learning progress.

Where supported by the application, progress is stored so users can return to their roadmaps later.

### 4. Contextual Learning Advice

Request AI-generated guidance for individual roadmap milestones.

Advice may include explanations, practical projects, interview preparation, and suggestions for further learning.

### 5. Career-Focused Learning Paths

Organise learning around a defined professional objective rather than following an unstructured collection of tutorials.

### 6. Multiple AI Provider Options

The application supports configurable AI integrations, depending on the provider and configuration used.

Supported provider options in the application include:

- Groq
- Google Gemini
- Anthropic Claude
- OpenAI-compatible APIs

Only configure providers supported by the current application implementation.

### 7. Development Mode

A mock AI provider is available for development when explicitly configured. This allows developers to test selected application flows without making real AI requests.

**Note:** Mock-generated content is placeholder data and should not be treated as genuine career analysis.

---

## How It Works

The typical workflow is:

**Step 1 — Define a Goal**

Choose a target role, such as Backend Developer, AI Engineer, Data Analyst, or another career objective.

**Step 2 — Generate a Roadmap**

The configured AI provider receives the relevant prompt and returns structured roadmap data.

**Step 3 — Explore the Roadmap**

Review the roadmap phases, skills, projects, prerequisites, and milestones.

**Step 4 — Work Through Milestones**

Study the relevant topics and complete the recommended activities.

**Step 5 — Track Progress**

Mark milestones as completed and monitor progress through the application.

**Step 6 — Get Additional Guidance**

Request contextual advice when you need help understanding a skill or planning a project.

---

## Technology Stack

Summit's implementation uses a lightweight web application architecture.

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime for the server |
| JavaScript ES Modules | Application logic and modular code organisation |
| Node.js HTTP server | Backend request handling |
| HTML, CSS and JavaScript | Web application interface |
| SQLite | Local relational database, where configured |
| AI provider APIs | Roadmap generation and personalised advice |
| Environment variables | Application and provider configuration |
| npm | Dependency management and application scripts |

The exact dependencies and capabilities depend on the current project files and installed packages.

---

## Application Architecture

Summit follows a modular architecture that separates request handling, AI integration, roadmap processing, and the user interface.

### Backend

The backend handles incoming requests and coordinates application functionality.

Important modules include:

- `server/index.js` — application server and request handling.
- `server/ai.js` — AI provider selection, API requests, response parsing, and roadmap/advice generation.
- `server/prompts.js` — prompts used for roadmap generation and personalised advice.
- `server/roadmap.js` — roadmap and advice normalisation.
- `server/env.js` — environment configuration, where used.

### AI Integration

The AI integration layer selects a configured provider, sends requests, processes the response, and converts structured output into the format expected by the application.

### Frontend

The frontend provides the user-facing experience for creating roadmaps, exploring milestones, and tracking learning progress.

### Database

Database-backed functionality depends on the application's configured database and persistence implementation.

---

## Getting Started

Follow these instructions to run Summit locally.

### Prerequisites

Install the following:

- Node.js
- npm
- A modern web browser
- An API key for a supported AI provider, if you want to use real AI generation

Check your Node.js and npm installations:

```bash
node --version
npm --version
```

### 1. Download the Project

Clone the repository if it is hosted on GitHub:

```bash
git clone <YOUR_REPOSITORY_URL>
```

Alternatively, download and extract the project ZIP archive.

### 2. Navigate to the Project Directory

```bash
cd summit-roadmapper
```

Make sure you are in the directory containing `package.json`.

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root, alongside `package.json`.

You can use `.env.example` as a reference if it is included in the project.

Add the configuration for your selected AI provider as described below.

### 5. Start the Application

```bash
npm start
```

If the server starts successfully, open the local address shown in the terminal. If the application uses port `3000`, the address is typically:

```text
http://localhost:3000
```

---

## Environment Configuration

Summit uses environment variables for application settings and AI provider credentials.

**Never commit your actual `.env` file or API keys to a public repository.**

### General Configuration

```env
PORT=3000
COOKIE_SECURE=0
AI_PROVIDER=groq
```

`COOKIE_SECURE=0` is intended for local HTTP development. When deploying behind HTTPS, follow the application's deployment requirements and enable secure cookies where appropriate.

### Option 1: Groq

Add the following to `.env`:

```env
PORT=3000
AI_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
COOKIE_SECURE=0
```

Replace `your_groq_api_key` with your actual key.

The model name must be supported by your Groq account and the application's API integration.

### Option 2: Google Gemini

```env
PORT=3000
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
COOKIE_SECURE=0
```

Use a model that is available to your API account and supported by the integration.

### Option 3: Anthropic Claude

```env
PORT=3000
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-sonnet-4-5
COOKIE_SECURE=0
```

API access and usage may require billing or prepaid credits.

### Option 4: OpenAI-Compatible API

```env
PORT=3000
AI_PROVIDER=openai
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
COOKIE_SECURE=0
```

Use the appropriate base URL, model name, and credentials for your selected compatible provider.

### Option 5: Mock Development Mode

For development flows that support mock responses:

```env
PORT=3000
AI_PROVIDER=mock
COOKIE_SECURE=0
```

Mock mode does not perform real AI analysis.

### Configuration Guidelines

- Use one provider configuration at a time unless you intentionally want the application's automatic provider selection.
- Keep variable names exactly as shown.
- Do not leave the API key empty.
- Do not add spaces around the `=` sign.
- Do not put your actual API key in `README.md`.
- Restart the application after changing environment variables.
- Confirm the configured model remains available with your provider.

---

## Running the Application

Start the application:

```bash
npm start
```

Stop it with `Ctrl + C`.

If you modify environment variables, restart the server so the new configuration can take effect.

### Troubleshooting

#### Error: No AI provider is configured

Possible causes:

- `.env` is missing.
- `.env` is in the wrong directory.
- The API key variable is empty or incorrectly named.
- The environment configuration is not being loaded.
- The selected provider is not configured correctly.

Check that `.env` is located alongside `package.json`.

#### Error: Model does not exist or access is denied

Check the configured model name and verify that the model is currently available to your provider account.

For Groq, review:

```env
GROQ_MODEL=openai/gpt-oss-120b
```

The model specified in `.env` takes precedence over the default in the application code.

#### Error: Invalid API key or authentication failure

Verify the API key in the provider's official console. Ensure that you have not accidentally included quotation marks, extra spaces, or placeholder text.

#### Error: Port already in use

Another process may be using the configured port. Stop the other process or select an available port in `.env`.

#### Error: Application fails to start

Check the terminal output for the exact error. Confirm that dependencies have been installed and that the required environment configuration is present.

---

## Testing

Run the tests provided by the project.

For example, if the corresponding npm scripts exist:

```bash
npm test
```

If the project defines additional checks, they may include:

```bash
npm run lint
npm run typecheck
npm run build
```

Run only the commands that are defined in `package.json`.

Before publishing a release, verify:

- The server starts without errors.
- The configured AI provider can be reached.
- Roadmap generation returns valid structured data.
- Roadmap and advice responses are handled correctly.
- The frontend can display generated roadmaps.
- Progress updates behave as expected.
- Database operations work when persistence is configured.
- Secrets are excluded from the repository.

---

## Project Structure

The following is a simplified representation of the expected project organisation. Your actual files may differ.

```text
summit-roadmapper/
├── server/
│   ├── index.js
│   ├── ai.js
│   ├── prompts.js
│   ├── roadmap.js
│   └── env.js
├── public/
│   └── ... frontend assets
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

### Important Files

| File | Responsibility |
|---|---|
| `server/index.js` | Backend server and routes |
| `server/ai.js` | AI provider configuration and generation |
| `server/prompts.js` | AI prompts |
| `server/roadmap.js` | Roadmap/advice response normalisation |
| `server/env.js` | Environment loading, where implemented |
| `public/` | Frontend assets |
| `.env.example` | Example configuration without real secrets |
| `.gitignore` | Files excluded from version control |
| `package.json` | Dependencies and npm scripts |
| `README.md` | Project documentation |

---

## AI Integration

Summit uses a provider abstraction to support multiple AI services.

The application selects a provider based on its configuration and sends prompts for roadmap or advice generation.

The AI integration is responsible for:

1. Selecting the configured provider.
2. Sending the relevant prompt to the provider.
3. Handling API responses and errors.
4. Extracting structured JSON output.
5. Normalising the returned roadmap or advice.
6. Returning the processed data to the application.

AI-generated output can be incomplete, inaccurate, or outdated. Users should verify important career requirements, technical recommendations, and learning resources.

Provider availability, supported models, API limits, and pricing may change over time.

---

## Security and Privacy

Security is an important consideration for applications that handle accounts, personal learning data, and API credentials.

Recommended practices include:

- Store API keys in environment variables.
- Keep `.env` out of version control.
- Include placeholders rather than real credentials in `.env.example`.
- Use HTTPS in production.
- Configure secure session cookies for HTTPS deployments.
- Validate incoming requests.
- Handle errors without exposing secrets.
- Keep application dependencies updated.
- Back up persistent data where necessary.

Do not assume that all security controls are production-ready without reviewing and testing the implementation.

---

## Limitations

Summit is intended to assist with career planning and learning organisation. Its recommendations should not be treated as guarantees of employment or professional success.

Potential limitations include:

- AI output depends on the selected model and prompt quality.
- Model availability and API limits depend on the provider.
- Some recommendations may require manual verification.
- AI responses may contain inaccurate or outdated information.
- Persistence and authentication capabilities depend on the configured application implementation.
- Mock mode produces placeholder data rather than real AI-generated guidance.

---

## Future Enhancements

Potential improvements include:

- User-specific career recommendations.
- More detailed skill dependency analysis.
- Advanced roadmap editing.
- Additional learning-resource integrations.
- Improved progress analytics and milestones.
- Exportable roadmaps and progress reports.
- Enhanced accessibility and responsive design.
- Additional AI providers and model selection.
- More comprehensive automated testing.
- Production deployment and monitoring.
- Collaboration features for mentors, students, and teams.

These are potential future improvements and should not be interpreted as existing features unless implemented.

---

## Contributing

Contributions, bug reports, and suggestions are welcome.

To propose a change:

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Run the relevant tests.
5. Submit a pull request describing the change.

For significant changes, consider opening an issue first to discuss the proposed implementation.

---

## License

Choose and add an appropriate open-source license before distributing the project publicly.

If a license has already been included in the repository, follow its terms.

---

## Acknowledgements

Summit brings together web development, AI integration, structured learning plans, and interactive visualisation to make career preparation easier to organise.

Built to help learners turn career ambitions into actionable progress.

---

**Summit — Your career journey, mapped out.**
