import { adminRequest, getParkingSession, type ParkingSession } from "../../../lib/parking-auth";

function vehicle(row: Record<string, unknown>, staff = false) {
  return {
    id: Number(row.id),
    slot: String(row.slot),
    plate: String(row.plate),
    driverName: String(row.driver_name),
    phone: staff ? "" : String(row.phone),
    vehicleType: staff ? "" : String(row.vehicle_type),
    monthlyFee: staff ? 0 : Number(row.monthly_fee),
    monthPaid: staff ? false : Boolean(row.month_paid),
    washCredits: Number(row.wash_credits),
    createdAt: String(row.created_at),
  };
}

function wash(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    plate: String(row.plate),
    workItem: String(row.work_item),
    price: Number(row.price),
    discount: Number(row.discount),
    finalAmount: Number(row.final_amount),
    usedCredit: Boolean(row.used_credit),
    createdAt: String(row.created_at),
  };
}

function service(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    plate: String(row.plate),
    serviceName: String(row.service_name),
    price: Number(row.price),
    discount: Number(row.discount),
    finalAmount: Number(row.final_amount),
    bonusWashes: Number(row.bonus_washes),
    note: String(row.note || ""),
    createdAt: String(row.created_at),
  };
}

function payment(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    plate: String(row.plate),
    amount: Number(row.amount),
    paymentType: String(row.payment_type),
    createdAt: String(row.created_at),
  };
}

function message(error: unknown) {
  const text = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
  if (text.includes("parking_vehicles_plate_key")) return "Biển số này đã có trong bãi.";
  return text;
}

async function requireSession() {
  const session = await getParkingSession();
  if (!session) return null;
  return session;
}

async function adminData(session: ParkingSession) {
  const [vehicles, washes, services, payments] = await Promise.all([
    adminRequest("parking_vehicles?select=*&order=id.desc"),
    adminRequest("parking_washes?select=*&order=created_at.desc,id.desc&limit=200"),
    adminRequest("parking_services?select=*&order=created_at.desc,id.desc&limit=200"),
    adminRequest("parking_payments?select=*&order=created_at.desc,id.desc&limit=200"),
  ]) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[]];
  return {
    vehicles: vehicles.map((row) => vehicle(row)),
    washes: washes.map(wash),
    services: services.map(service),
    payments: payments.map(payment),
    session,
  };
}

async function staffData(session: ParkingSession) {
  const [vehicles, washes] = await Promise.all([
    adminRequest("parking_vehicles?select=id,slot,plate,driver_name,wash_credits,created_at&order=plate.asc"),
    adminRequest("parking_washes?select=*&order=created_at.desc,id.desc&limit=100"),
  ]) as [Record<string, unknown>[], Record<string, unknown>[]];
  return {
    vehicles: vehicles.map((row) => vehicle(row, true)),
    washes: washes.map(wash),
    services: [],
    payments: [],
    session,
  };
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return Response.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    return Response.json(session.role === "admin" ? await adminData(session) : await staffData(session));
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return Response.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
    const payload = (await request.json()) as Record<string, unknown>;
    const action = String(payload.action || "");
    if (session.role !== "admin" && action !== "recordWash") {
      return Response.json({ error: "Tài khoản nhân viên chỉ được ghi lượt rửa xe." }, { status: 403 });
    }

    const rpc: Record<string, { name: string; body: Record<string, unknown> }> = {
      addVehicle: {
        name: "parking_add_vehicle",
        body: {
          p_slot: payload.slot,
          p_plate: payload.plate,
          p_driver_name: payload.driverName,
          p_phone: payload.phone,
          p_vehicle_type: payload.vehicleType,
          p_monthly_fee: payload.monthlyFee,
          p_month_paid: payload.monthPaid,
          p_wash_credits: payload.washCredits,
        },
      },
      recordWash: {
        name: "parking_record_wash",
        body: {
          p_vehicle_id: payload.vehicleId,
          p_plate: payload.plate,
          p_work_item: payload.workItem,
          p_price: payload.price,
          p_discount: payload.discount,
          p_used_credit: payload.usedCredit,
        },
      },
      collectPayment: {
        name: "parking_collect_payment",
        body: {
          p_vehicle_id: payload.vehicleId,
          p_amount: payload.amount,
          p_note: payload.note,
        },
      },
      addService: {
        name: "parking_add_service",
        body: {
          p_vehicle_id: payload.vehicleId,
          p_plate: payload.plate,
          p_service_name: payload.serviceName,
          p_price: payload.price,
          p_discount: payload.discount,
          p_bonus_washes: payload.bonusWashes,
          p_note: payload.note,
        },
      },
      togglePaid: {
        name: "parking_toggle_paid",
        body: {
          p_vehicle_id: payload.vehicleId,
          p_month_paid: payload.monthPaid,
        },
      },
    };
    const selected = rpc[action];
    if (!selected) return Response.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
    await adminRequest(`rpc/${selected.name}`, { method: "POST", body: JSON.stringify(selected.body) });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}
