import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

function getContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: "File not specified" }, { status: 400 });
    }

    // Prevent path traversal
    const safeSegments = pathSegments.map((s) => path.basename(s));
    const filePath = path.join(process.cwd(), "public", "uploads", ...safeSegments);

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        return NextResponse.json({ error: "Not a file" }, { status: 404 });
      }

      const fileBuffer = await readFile(filePath);
      const ext = path.extname(filePath).replace(".", "").toLowerCase();
      const contentType = getContentType(ext);
      const fileName = path.basename(filePath);

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": fileStat.size.toString(),
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "public, max-age=3600, must-revalidate",
        },
      });
    } catch {
      return NextResponse.json({ error: "File tidak ditemukan di server" }, { status: 404 });
    }
  } catch (error) {
    console.error("Error serving uploaded file:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
