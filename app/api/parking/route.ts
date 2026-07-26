const now = () => new Date().toISOString();

const demoVehicles = [
  { id: 1, slot: "A01", plate: "DEMO-001", driverName: "Tài xế mẫu 01", phone: "0000 000 001", vehicleType: "Ô tô", monthlyFee: 1200000, monthPaid: true, washCredits: 3, createdAt: now() },
  { id: 2, slot: "A02", plate: "DEMO-002", driverName: "Tài xế mẫu 02", phone: "0000 000 002", vehicleType: "Ô tô", monthlyFee: 1200000, monthPaid: false, washCredits: 0, createdAt: now() },
  { id: 3, slot: "A03", plate: "DEMO-003", driverName: "Tài xế mẫu 03", phone: "0000 000 003", vehicleType: "Ô tô", monthlyFee: 1200000, monthPaid: true, washCredits: 2, createdAt: now() },
  { id: 4, slot: "B01", plate: "DEMO-004", driverName: "Tài xế mẫu 04", phone: "0000 000 004", vehicleType: "Ô tô", monthlyFee: 1200000, monthPaid: true, washCredits: 1, createdAt: now() },
  { id: 5, slot: "B02", plate: "DEMO-005", driverName: "Tài xế mẫu 05", phone: "0000 000 005", vehicleType: "Ô tô", monthlyFee: 1200000, monthPaid: false, washCredits: 4, createdAt: now() },
];

const demoData = {
  vehicles: demoVehicles,
  washes: [
    { id: 1, plate: "DEMO-001", workItem: "Rửa + hút bụi", price: 70000, discount: 0, finalAmount: 70000, usedCredit: false, createdAt: now() },
    { id: 2, plate: "DEMO-003", workItem: "Rửa thường", price: 50000, discount: 50000, finalAmount: 0, usedCredit: true, createdAt: now() },
  ],
  services: [
    { id: 1, plate: "DEMO-005", serviceName: "Đưa xe đi đăng kiểm", price: 650000, discount: 50000, finalAmount: 600000, bonusWashes: 2, note: "Hoàn tất trong ngày", createdAt: now() },
  ],
  payments: [
    { id: 1, plate: "DEMO-001", amount: 1200000, paymentType: "Tiền tháng", createdAt: now() },
    { id: 2, plate: "DEMO-003", amount: 1200000, paymentType: "Tiền tháng", createdAt: now() },
  ],
  demo: true,
};

function config() {
  return {
    url: (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, ""),
    key: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

async function supabase(path: string, init: RequestInit = {}) {
  const { url, key } = config();
  if (!url || !key) throw new Error("Chưa cấu hình Supabase trên máy chủ.");
  const legacyJwtKey = !key.startsWith("sb_secret_");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: key,
      ...(legacyJwtKey ? { Authorization: `Bearer ${key}` } : {}),
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Supabase trả về lỗi ${response.status}.`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function vehicle(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    slot: String(row.slot),
    plate: String(row.plate),
    driverName: String(row.driver_name),
    phone: String(row.phone),
    vehicleType: String(row.vehicle_type),
    monthlyFee: Number(row.monthly_fee),
    monthPaid: Boolean(row.month_paid),
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

export async function GET() {
  const { url, key } = config();
  if (!url || !key) return Response.json(demoData);

  try {
    const [vehicles, washes, services, payments] = await Promise.all([
      supabase("parking_vehicles?select=*&order=id.desc"),
      supabase("parking_washes?select=*&order=created_at.desc,id.desc&limit=200"),
      supabase("parking_services?select=*&order=created_at.desc,id.desc&limit=200"),
      supabase("parking_payments?select=*&order=created_at.desc,id.desc&limit=200"),
    ]) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[]];

    return Response.json({
      vehicles: vehicles.map(vehicle),
      washes: washes.map(wash),
      services: services.map(service),
      payments: payments.map(payment),
    });
  } catch (error) {
    return Response.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const action = String(payload.action || "");

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
    await supabase(`rpc/${selected.name}`, { method: "POST", body: JSON.stringify(selected.body) });
    return Response.json({ ok: true });
  } catch (error) {
    const text = message(error);
    const status = text.includes("Chưa cấu hình Supabase") ? 503 : 500;
    return Response.json({ error: text }, { status });
  }
}
