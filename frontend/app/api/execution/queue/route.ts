import { NextResponse } from "next/server";

import {
  ExecutionQueue
} from "../../../../lib/execution-preparation";

export async function GET() {

  const queue =
    ExecutionQueue.getAll();

  return NextResponse.json({
    success: true,
    queue,
    count: queue.length,
    updatedAt:
      new Date().toISOString()
  });
}