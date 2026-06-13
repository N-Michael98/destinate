export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    PYTHON_BACKEND_URL_dot: process.env.PYTHON_BACKEND_URL,
    PYTHON_BACKEND_URL_bracket: process.env["PYTHON_BACKEND_URL"],
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
  });
}
