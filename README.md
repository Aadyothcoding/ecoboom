# 🌍 3D Global Finance Intelligence Tool

A full-stack Semi-3D globe visualization of global finance intelligence, built with CesiumJS, React, Node/Express, and the Groq AI API.

## Features ✨

### 1. CesiumJS 3D Globe
- Interactive full-earth 3D map using `cesium` and `vite-plugin-cesium`.
- Dark finance-themed universe with customized colors.
- Global stock exchange markers showing open/close status and AI real-time prediction heat mapping (Green for Boom, Red for Crash).
- Floating billboard pins for hot macroeconomic events.

### 2. Node.js + Express Backend
- Scrapes trending globally scaled and regional macroeconomic news using `rss-parser`.
- Tracks timezone-accurate timings for 14 major stock exchanges (NYSE, BSE, LSE, TSE etc.).
- Simulates market conditions and calculates active sentiment logic.

### 3. Groq AI Integration
- Lightning-fast Llama 3 70B inference analyzing headlines and producing dynamic market risk metrics, "one-line" summaries, and heat scores to drive UX mapping decisions on the fly. 

### 4. Glowing Realtime Aesthetics
- Smooth glassmorphism panels, dark mode, gradient glowing text.
- Recharts integration for beautiful spline-based AI trend charting.
- Moving news ticker feed mimicking Bloomberg terminal vibes.

---

## Technical Stack
- **Frontend**: React, Vite, CesiumJS, Recharts, Axios, Lucide React, Vanilla CSS.
- **Backend**: Node.js, Express, Groq API SDK, rss-parser.

---

## Setup & Running Locally ⚙️

### 1. Setting Up the Backend
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies (should already be done):
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` directory and add your Groq API Key:
   ```
   GROQ_API_KEY=your_key_here
   PORT=3000
   ```
4. Start the backend:
   ```bash
   npm start
   ```

### 2. Setting Up the Frontend
1. Open a new terminal tab and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:5173`.

Enjoy exploring global financial dynamics dynamically driven by AI!
