export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  const k = 'PYTHON_BACKEND_URL';
  return NextResponse.json({
    dot: process.env.PYTHON_BACKEND_URL,
    bracket: process.env['PYTHON_BACKEND_URL'],
    varKey: process.env[k],
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    allPythonKeys: Object.keys(process.env).filter(key => key.includes('PYTHON') || key.includes('BACKEND')),
  });
}
