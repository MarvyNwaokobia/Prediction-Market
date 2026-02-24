# Prediction Market

This is a monorepo containing the frontend and smart contracts for the Prediction Market application.

## Structure

- `frontend/`: Next.js frontend application
- `contracts/`: Cairo smart contracts

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Contracts

```bash
cd contracts
scarb build
snforge test
```
