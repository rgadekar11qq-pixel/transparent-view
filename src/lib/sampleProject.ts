// A small embedded sample project so users can try CodeAtlas immediately.
// Represents a realistic React + FastAPI + PostgreSQL app.

export const SAMPLE_PROJECT = {
  'package.json': JSON.stringify({
    name: 'taskflow',
    private: true,
    version: '1.0.0',
    dependencies: {
      react: '^18.3.1', 'react-dom': '^18.3.1', 'react-router-dom': '^6.26.0',
      axios: '^1.7.0', tailwindcss: '^3.4.0',
    },
    devDependencies: { vite: '^5.4.0', typescript: '^5.5.0', vitest: '^2.0.0' },
  }, null, 2),
  'vite.config.ts': "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({ plugins: [react()] })\n",
  'index.html': '<!doctype html>\n<html>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n',
  'src/main.tsx': "import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\n\nReactDOM.createRoot(document.getElementById('root')!).render(<App />)\n",
  'src/App.tsx': "import { BrowserRouter, Routes, Route } from 'react-router-dom'\nimport LoginPage from './pages/LoginPage'\nimport Dashboard from './pages/Dashboard'\n\nexport default function App() {\n  return (\n    <BrowserRouter>\n      <Routes>\n        <Route path=\"/login\" element={<LoginPage />} />\n        <Route path=\"/\" element={<Dashboard />} />\n      </Routes>\n    </BrowserRouter>\n  )\n}\n",
  'src/pages/LoginPage.tsx': "import { useState } from 'react'\nimport api from '../api/client'\n\nexport default function LoginPage() {\n  const [email, setEmail] = useState('')\n  const [password, setPassword] = useState('')\n\n  async function handleSubmit(e: React.FormEvent) {\n    e.preventDefault()\n    await api.post('/api/auth/login', { email, password })\n  }\n\n  return <form onSubmit={handleSubmit}>{/* login form */}</form>\n}\n",
  'src/pages/Dashboard.tsx': "import { useEffect, useState } from 'react'\nimport api from '../api/client'\n\nexport default function Dashboard() {\n  const [tasks, setTasks] = useState([])\n  useEffect(() => {\n    api.get('/api/tasks').then((res) => setTasks(res.data))\n  }, [])\n  return <div>{/* task list */}</div>\n}\n",
  'src/api/client.ts': "import axios from 'axios'\n\nconst api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000' })\nexport default api\n",
  'backend/requirements.txt': 'fastapi==0.111.0\nuvicorn[standard]==0.30.0\nsqlalchemy==2.0.30\npsycopg2-binary==2.9.9\npython-jose[cryptography]==3.3.0\npasslib[bcrypt]==1.7.4\npytest==8.2.0\n',
  'backend/app/main.py': "from fastapi import FastAPI\nfrom app.routers import auth, tasks\n\napp = FastAPI(title='TaskFlow API')\napp.include_router(auth.router, prefix='/api/auth')\napp.include_router(tasks.router, prefix='/api/tasks')\n",
  'backend/app/routers/auth.py': "from fastapi import APIRouter, Depends\nfrom app.services.auth_service import login_user\n\nrouter = APIRouter()\n\n@router.post('/login')\ndef login(email: str, password: str):\n    return login_user(email, password)\n",
  'backend/app/routers/tasks.py': "from fastapi import APIRouter\nfrom app.services.task_service import list_tasks, create_task\n\nrouter = APIRouter()\n\n@router.get('/')\ndef get_tasks():\n    return list_tasks()\n\n@router.post('/')\ndef post_task(title: str):\n    return create_task(title)\n",
  'backend/app/services/auth_service.py': "import os\nfrom jose import jwt\nfrom app.db import SessionLocal\nfrom app.models import User\n\nSECRET = os.environ['JWT_SECRET']\n\ndef login_user(email: str, password: str):\n    db = SessionLocal()\n    user = db.query(User).filter(User.email == email).first()\n    if not user or not user.verify_password(password):\n        return {'error': 'invalid credentials'}\n    token = jwt.encode({'sub': user.email}, SECRET, algorithm='HS256')\n    return {'access_token': token}\n",
  'backend/app/services/task_service.py': "from app.db import SessionLocal\nfrom app.models import Task\n\ndef list_tasks():\n    db = SessionLocal()\n    return db.query(Task).all()\n\ndef create_task(title: str):\n    db = SessionLocal()\n    task = Task(title=title)\n    db.add(task)\n    db.commit()\n    return task\n",
  'backend/app/db.py': "import os\nfrom sqlalchemy import create_engine\nfrom sqlalchemy.orm import sessionmaker\n\nDATABASE_URL = os.environ['DATABASE_URL']\nengine = create_engine(DATABASE_URL)\nSessionLocal = sessionmaker(bind=engine)\n",
  'backend/app/models.py': "from sqlalchemy.orm import declarative_base, Mapped, mapped_column\n\nBase = declarative_base()\n\nclass User(Base):\n    __tablename__ = 'users'\n    id: Mapped[int] = mapped_column(primary_key=True)\n    email: Mapped[str]\n    password_hash: Mapped[str]\n\nclass Task(Base):\n    __tablename__ = 'tasks'\n    id: Mapped[int] = mapped_column(primary_key=True)\n    title: Mapped[str]\n",
  'backend/tests/test_auth.py': "from app.services.auth_service import login_user\n\ndef test_login_rejects_bad_password():\n    assert login_user('a@b.c', 'wrong') == {'error': 'invalid credentials'}\n",
  'backend/Dockerfile': 'FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nCMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]\n',
  'docker-compose.yml': "services:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: supersecret123\n  api:\n    build: ./backend\n    environment:\n      DATABASE_URL: postgres://user:supersecret123@db:5432/taskflow\n      JWT_SECRET: do-not-share-me\n",
  '.env.example': 'DATABASE_URL=postgres://user:password@localhost:5432/taskflow\nJWT_SECRET=change-me\nVITE_API_URL=http://localhost:8000\n',
  '.github/workflows/ci.yml': "name: ci\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: pip install pytest\n      - run: pytest backend/tests\n",
};
