import { getParkingSession, loginParkingUser, logoutParkingUser } from "../../../lib/parking-auth";

function message(error: unknown) {
  const text = error instanceof Error ? error.message : "Đăng nhập không thành công.";
  if (text.toLowerCase().includes("invalid login credentials")) return "Tên đăng nhập hoặc mật khẩu không đúng.";
  return text;
}

export async function GET() {
  try {
    const session = await getParkingSession();
    if (!session) return Response.json({ error: "Chưa đăng nhập." }, { status: 401 });
    return Response.json({ session });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { username?: string; password?: string };
    const session = await loginParkingUser(payload.username || "", payload.password || "");
    return Response.json({ session });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 401 });
  }
}

export async function DELETE() {
  await logoutParkingUser();
  return Response.json({ ok: true });
}
