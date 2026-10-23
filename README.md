# 📦 3D Pallet Stacking & Packing Optimization Studio

An advanced, interactive web application for **3D Pallet Stacking, Container Cargo Packing, and Load Optimization**. Built with **React 19**, **Three.js / React Three Fiber**, **Tailwind CSS v4**, and **TypeScript**, this tool enables logistics planners, warehouse operators, and cargo managers to calculate, visualize, and optimize box placement on pallets with physics-aware layer validation and detailed volumetric analytics.

---

## ✨ Features

### 🧊 Interactive 3D Visualization
* **Full 3D Orbit & Inspection**: Rotate, pan, zoom, and inspect pallet arrangements with dynamic shadows, grid helpers, and box dimension labels.
* **Layer-by-Layer View**: Filter and visualize specific cargo layers (e.g., Layer 1, Layer 2, Layer 3+) to inspect underlying support structures.
* **Selection & Hover Details**: Click or hover on individual boxes to view dimensions, weight, coordinates, orientation, and layer placement.

### 📐 Physics-Aware Stacking Logic
* **Multi-Height Coplanar Support**: Correctly calculates resting height ($Z$) for boxes placed on top of lower layers containing boxes with variable heights.
* **AABB 3D Collision Detection**: Prevents overlapping boxes during manual placement and automated packing.
* **Bottom Overhang & Support Validation**: Ensures boxes are physically supported by lower surfaces or the pallet base before placement.
* **Rotation Controls**: Flexibly rotate boxes ($0^\circ / 90^\circ$) to maximize floor utilization and stability.

### 📊 Excel Manifest Import & Export
* **Bulk Cargo Import**: Upload Excel files (`.xlsx`, `.xls`) to import cargo lists containing box dimensions ($L \times W \times H$), quantities, weight, and color preferences.
* **Packing Report Export**: Generate comprehensive Excel report exports including spatial coordinates ($X, Y, Z$), layer index, stability metrics, and total volume/weight summaries.

### 🤖 Smart Optimization & AI Integration
* **Auto-Packing Engine**: Automated heuristic algorithms for row-by-row and column-first cargo placement.
* **AI Cargo Assistant**: Powered by Google Gemini (`@google/genai`) for intelligent load balancing recommendations, stacking safety checks, and report generation.

### 🚚 Pallet & Container Metrics
* **Standard & Custom Pallets**: Preset support for EUR Pallets ($1200 \times 800 \text{ mm}$), Industrial Pallets ($1200 \times 1000 \text{ mm}$), and custom dimensions.
* **Real-time Analytics**: Live statistics for total weight, volume utilization ($\text{m}^3$), box count, center of gravity, and overhang alerts.

---

## 🛠️ Tech Stack

* **Frontend Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
* **Build Tool**: [Vite](https://vitejs.dev/)
* **3D Graphics & Rendering**: [Three.js](https://threejs.org/), [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber/), [@react-three/drei](https://github.com/pmndrs/drei)
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
* **Animations & UI**: [Framer Motion](https://www.framer.com/motion/), [Lucide React Icons](https://lucide.dev/)
* **Data Processing**: [SheetJS (XLSX)](https://sheetjs.com/) for spreadsheet parsing and exporting
* **AI Engine**: [@google/genai](https://www.npmjs.com/package/@google/genai) SDK

---

## 🚀 Getting Started

### Prerequisites
Make sure you have **Node.js** (v18.x or higher) and **npm** installed on your system.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/3d-pallet-packing-studio.git
   cd 3d-pallet-packing-studio
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables** (Optional):
   Create a `.env` file in the root directory if using Google Gemini AI integrations:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000` to interact with the application.

---

## 💻 Available Scripts

In the project directory, you can run:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the app in dev mode on `http://localhost:3000` |
| `npm run build` | Builds the app for production in the `dist` directory |
| `npm run preview` | Previews the production build locally |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) |
| `npm run clean` | Removes the `dist` build directory |

---

## 📁 Project Structure

```text
.
├── public/                # Static assets & media files
├── src/
│   ├── components/        # React & 3D components
│   │   ├── studio/        # 3D Canvas, Pallet, Box meshes, Orbit Controls
│   │   ├── ui/            # Control panels, metrics bar, modal dialogs
│   │   └── reports/       # Report tables, export preview, charts
│   ├── utils/             # Packing algorithms, collision checks, height map logic
│   ├── types/             # TypeScript type definitions for cargo, pallets, layers
│   ├── App.tsx            # Main Application Layout & State Container
│   ├── main.tsx           # Application Entry Point
│   └── index.css          # Tailwind CSS global styles
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── vite.config.ts         # Vite build configuration
```

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
