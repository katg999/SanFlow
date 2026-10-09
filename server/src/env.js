// One env file for the whole project: .env / .env.local at the repo root (same files Next.js reads).
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
