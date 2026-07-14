# Build Workflow: ShiftWise Payroll

Follow these steps to install dependencies, perform typechecking, and compile the project for production.

## Prerequisites
- Node.js (version >= 20, recommended 24+) installed on the system.
- PowerShell script execution policy set appropriately (e.g. `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` if running on Windows).

---

## 1. Install Dependencies
Run this command from the project root to install all required packages:
```bash
npm install
```

---

## 2. Typecheck Code
Run TypeScript static type analysis to ensure type safety before compiling:
```bash
npm run typecheck
```
*(Alternative/Direct CLI: `npx tsc --noEmit`)*

---

## 3. Build Web Application
Compile the Next.js application for production:
```bash
npm run build
```

The build artifact will be generated under the `.next/` directory.
