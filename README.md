# Bioledger 🌿

**An offline-first field notebook for naturalists.**

Bioledger helps you record wildlife sightings, organize observations, and explore your field journal with AI. It's designed for people who want to spend more time outdoors and less time dealing with complicated tools.

🌐 **Live Demo:** https://bioledger.onrender.com  
📦 **Repository:** https://github.com/MohitSharma2003/bioledger

---

## 🌱 Why Bioledger?

Field observations often happen in places with limited or no internet connectivity. Bioledger aims to make recording and organizing those observations simple, with local AI as an optional assistant.

- **Field Notes:** Record wildlife sightings and observations.
- **AI-Assisted Observations:** Turn natural-language descriptions into structured field notes.
- **Ask Your Journal:** Ask questions about your recorded observations.
- **Offline-First Design:** Work toward keeping your notes available without a network connection.
- **Local AI:** Use a compatible model running on your own device instead of depending entirely on a cloud AI service.
- **Privacy-Focused:** Local inference can keep prompts and observations on your device when the application is configured to use local processing and storage.

## 🧠 How the AI Works

Bioledger is designed to support two AI approaches.

### 1. Browser-Local AI — For the Public Website

When Bioledger is deployed on Render, each visitor can run a compatible AI model directly in their browser.

The intended workflow is:

1. Open Bioledger in a compatible browser.
2. Choose a supported browser-local model.
3. Download the model files while connected to the internet.
4. Load the model and use AI-assisted features.
5. Reuse cached resources for offline operation when supported.

The model runs on the visitor's device rather than on Bioledger's hosting server. Performance depends on the model, available memory, browser capabilities, and hardware acceleration.

**Important:** Browser-local inference requires a compatible model and runtime. WebGPU support, available memory, model downloads, and browser storage can affect whether it works. Offline operation also requires the necessary application and model resources to be available locally.

### 2. Ollama — For Local Development and Self-Hosting

Bioledger can also use a locally running Ollama service where the backend and Ollama are configured to communicate.

For example, a developer can install Ollama and download a compatible model:

```bash
ollama pull gemma3:4b
ollama serve
```

The model must be available in the local Ollama installation, and the application must be configured to use the correct endpoint.

A public website hosted over HTTPS cannot automatically access an Ollama server running on a visitor's computer. Browser security restrictions, CORS, mixed-content policies, and local network permissions may prevent the connection.

Do not expose an unauthenticated Ollama endpoint directly to the public internet.

## 🏗️ Architecture

The intended architecture separates the application from the AI runtime.

```text
                         Bioledger
                             |
                  +----------+----------+
                  |                     |
             Public Website       Self-Hosted App
                  |                     |
          Browser-Local AI           Ollama
                  |                     |
          User's Own Device       Local AI Model
```

Browser-local inference and Ollama are separate execution options. Their availability depends on the deployed configuration and the models supported by each runtime.

## 🛠️ Technology Stack

The project uses a web application architecture with the following technologies:

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **Local AI:** Ollama and/or a compatible browser-local inference runtime
- **Browser Acceleration:** WebGPU where supported
- **Deployment:** Render

See the project source and dependency files for the exact versions and current implementation details.

## 🚀 Getting Started

### Prerequisites

Install the following tools:

- Git
- Python
- Node.js and npm
- Ollama, if you want to use the Ollama provider

### 1. Clone the repository

```bash
git clone https://github.com/MohitSharma2003/bioledger.git
cd bioledger
```

### 2. Set up the backend

Create and activate a Python virtual environment.

**Windows PowerShell:**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install the backend dependencies:

```bash
pip install -r requirements.txt
```

Start the backend:

```bash
uvicorn main:app --reload
```

The backend will normally be available at:

http://127.0.0.1:8000

### 3. Set up the frontend

Open a second terminal:

```bash
cd web
npm install
npm run dev
```

Open the local development URL printed by Vite in your terminal.

If the frontend uses a configurable API base URL, configure it according to the project's current environment-variable conventions.

### 4. Configure Ollama (Optional)

If using Ollama, make sure the service is running and the required model has been downloaded:

```bash
ollama pull gemma3:4b
ollama serve
```

Configure Bioledger's backend to use the correct Ollama endpoint. Check the project's configuration and environment variables for the expected setting.

Browser-local AI does not require the visitor to install Ollama, provided the browser model implementation is available and configured correctly.

## 🌐 Deployment

Bioledger's public demo is hosted on Render:

https://bioledger.onrender.com

When deploying a new version:

1. Commit and push the intended application changes.
2. Verify that the Render build installs all required dependencies.
3. Ensure the frontend is built and the deployed backend serves the correct frontend assets, if using a combined deployment.
4. Configure persistent storage if observations or photos must survive server restarts and redeployments.
5. Verify that the deployed application exposes the intended AI providers.
6. Test the deployed application in a browser, including model loading, observation creation, journal questions, and offline behavior.

### Public Deployment Considerations

- Do not assume the public Render instance can use Ollama installed on a developer's computer.
- Do not expose private API keys or service-role credentials in frontend code.
- Avoid claiming that all data stays on-device unless network requests, storage, and inference paths have been verified.
- Free hosting environments may have ephemeral filesystems. Confirm the storage configuration before relying on server-side persistence.

## 🔒 Privacy and Offline Use

Bioledger is intended to support local-first field recording.

For genuinely offline and privacy-preserving operation, the application needs to ensure that:

- Notes are stored locally when offline use is required.
- The selected AI model and its dependencies are downloaded and cached.
- AI inference happens in the intended local runtime.
- The application does not silently send observations or prompts to a remote AI service.
- Any optional synchronization is explicit and clearly explained.

Browser caching can be cleared or evicted by the browser. Users should not treat cached browser storage as a guaranteed backup.

## 🧪 Testing

Before relying on Bioledger in the field, test these scenarios:

- Create and save an observation.
- Reload the application and confirm the observation remains available.
- Load the selected AI model and create a structured field note.
- Ask a question about previously recorded observations.
- Disconnect the internet and repeat supported workflows.
- Confirm the expected behavior when a model is unavailable or unsupported.
- Verify that no unintended network requests contain private observations.

## 🗺️ Roadmap

- [ ] Reliable offline observation storage
- [ ] Browser-local AI model selection and lifecycle management
- [ ] Ollama support for local and self-hosted deployments
- [ ] Better wildlife observation organization
- [ ] Photo-assisted observation workflows
- [ ] Optional data export and backup
- [ ] Improved installable PWA experience

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes and test them.
4. Open a pull request describing the changes.

## 📄 License

Check the repository for the current license and its terms before redistributing or modifying the project.

---

**Bioledger — Observe nature. Record what you find. Keep your field notes close.**
