import { adminRequest, getParkingSession, type ParkingSession } from "../../../lib/parking-auth";

const LEGACY_CREATOR_MARKER = " ⟦parking_creator:";

function workItemWithCreator(workItem: string, creatorName: string) {
  const cleanWorkItem = workItem.trim();
  const cleanCreatorName = creatorName.trim();
  if (!cleanCreatorName) return cleanWorkItem;
  return `${cleanWorkItem}${LEGACY_CREATOR_MARKER}${encodeURIComponent(cleanCreatorName)}⟧`;
}

function parsedWorkItem(value: unknown) {
  const raw = String(value || "");
  const markerIndex = raw.lastIndexOf(LEGACY_CREATOR_MARKER);
  if (markerIndex < 0 || !raw.endsWith("⟧")) {
    return { workItem: raw, createdByName: "" };
  }

  const encodedName = raw.slice(markerIndex + LEGACY_CREATOR_MARKER.length, -1);
  try {
    return {
      workItem: raw.slice(0, markerIndex),
      createdByName: decodeURIComponent(encodedName),
    };
  } catch {
    return { workItem: raw, createdByName: "" };
  }
}

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
  const parsed = parsedWorkItem(row.work_item);
  return {
    id: Number(row.id),
    vehicleId: Number(row.vehicle_id || 0),
    plate: String(row.plate),
    workItem: parsed.workItem,
    price: Number(row.price),
    discount: Number(row.discount),
    finalAmount: Number(row.final_amount),
    usedCredit: Boolean(row.used_credit),
    createdById: String(row.created_by || ""),
    createdByName: String(row.created_by_name || parsed.createdByName || ""),
    createdAt: String(row.created_at),
  };
}

function service(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    vehicleId: Number(row.vehicle_id || 0),
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
    vehicleId: Number(row.vehicle_id || 0),
    plate: String(row.plate),
    amount: Number(row.amount),
    paymentType: String(row.payment_type),
    note: String(row.note || ""),
    createdAt: String(row.created_at),
  };
}

function notification(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    type: String(row.type),
    title: String(row.title),
    body: String(row.body),
    sourceId: row.source_id == null ? null : Number(row.source_id),
    createdByName: String(row.created_by_name || ""),
    isRead: Boolean(row.is_read),
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

async function setVehicleWashCredits(vehicleId: number, value: number) {
  if (!vehicleId) return;
  await adminRequest(`parking_vehicles?id=eq.${vehicleId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ wash_credits: Math.max(Math.trunc(value), 0) }),
  });
}

async function vehicleWashCredits(vehicleId: number) {
  if (!vehicleId) return 0;
  const rows = await adminRequest(
    `parking_vehicles?select=wash_credits&id=eq.${vehicleId}&limit=1`,
  ) as Record<string, unknown>[];
  if (!rows.length) throw new Error("Không tìm thấy xe liên quan.");
  return Number(rows[0].wash_credits || 0);
}

async function adminData(session: ParkingSession) {
  const notificationsRequest = adminRequest(
    "parking_notifications?select=*&order=created_at.desc,id.desc&limit=100",
  ).catch(() => []);
  const profilesRequest = adminRequest(
    "parking_profiles?select=user_id,full_name&is_active=eq.true",
  ).catch(() => []);
  const [vehicles, washes, services, payments, notifications, profiles] = await Promise.all([
    adminRequest("parking_vehicles?select=*&order=id.desc"),
    adminRequest("parking_washes?select=*&order=created_at.desc,id.desc&limit=200"),
    adminRequest("parking_services?select=*&order=created_at.desc,id.desc&limit=200"),
    adminRequest("parking_payments?select=*&order=created_at.desc,id.desc&limit=200"),
    notificationsRequest,
    profilesRequest,
  ]) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[]];
  const savedNotifications = notifications.map(notification);
  const profileNames = new Map(
    profiles.map((row) => [String(row.user_id), String(row.full_name || "")]),
  );
  const notificationNames = new Map(
    savedNotifications
      .filter((item) => item.sourceId != null && item.createdByName)
      .map((item) => [item.sourceId as number, item.createdByName]),
  );
  const enrichedWashes: Record<string, unknown>[] = washes.map((row) => {
    const parsed = parsedWorkItem(row.work_item);
    return {
      ...row,
      work_item: parsed.workItem,
      created_by_name: String(row.created_by_name || "") ||
        parsed.createdByName ||
        profileNames.get(String(row.created_by || "")) ||
        notificationNames.get(Number(row.id)) ||
        "",
    };
  });
  const notifiedWashIds = new Set(
    savedNotifications
      .map((item) => item.sourceId)
      .filter((id): id is number => id != null),
  );
  const washNotifications = enrichedWashes
    .filter((row) => !notifiedWashIds.has(Number(row.id)))
    .slice(0, 100)
    .map((row) => {
      const creator = String(row.created_by_name || "");
      return {
        id: 1_000_000_000 + Number(row.id),
        type: "wash_activity",
        title: creator ? `${creator} vừa nhập lượt rửa` : "Có lượt rửa mới được nhập",
        body: `Đã ghi ${String(row.work_item)} cho xe ${String(row.plate)}.`,
        sourceId: Number(row.id),
        createdByName: creator,
        isRead: false,
        createdAt: String(row.created_at),
      };
    });
  const mergedNotifications = [...savedNotifications, ...washNotifications]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);

  return {
    vehicles: vehicles.map((row) => vehicle(row)),
    washes: enrichedWashes.map(wash),
    services: services.map(service),
    payments: payments.map(payment),
    notifications: mergedNotifications,
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
    notifications: [],
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

    if (action === "updateVehicle") {
      const vehicleId = Number(payload.vehicleId);
      const slot = String(payload.slot || "").trim().toLocaleUpperCase("vi");
      const plate = String(payload.plate || "").trim().toLocaleUpperCase("vi");
      const ownerName = String(payload.driverName || "").trim();
      const phone = String(payload.phone || "").trim();
      if (!vehicleId || !slot || !plate || !ownerName || !phone) {
        return Response.json({ error: "Vui lòng nhập đủ ô đỗ, biển số, chủ xe và số điện thoại." }, { status: 400 });
      }
      const updated = await adminRequest(`parking_vehicles?id=eq.${vehicleId}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          slot,
          plate,
          driver_name: ownerName,
          phone,
          vehicle_type: String(payload.vehicleType || "Ô tô").trim() || "Ô tô",
          monthly_fee: Math.max(Number(payload.monthlyFee) || 0, 0),
          month_paid: Boolean(payload.monthPaid),
          wash_credits: Math.max(Math.trunc(Number(payload.washCredits) || 0), 0),
        }),
      }) as Record<string, unknown>[];
      if (!updated.length) {
        return Response.json({ error: "Không tìm thấy xe cần chỉnh sửa." }, { status: 404 });
      }
      return Response.json({ ok: true });
    }

    if (action === "deleteVehicle") {
      const vehicleId = Number(payload.vehicleId);
      if (!vehicleId) return Response.json({ error: "Xe không hợp lệ." }, { status: 400 });
      await adminRequest(`parking_vehicles?id=eq.${vehicleId}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      return Response.json({ ok: true });
    }

    if (action === "updateWash") {
      const washId = Number(payload.washId);
      const rows = await adminRequest(
        `parking_washes?select=*&id=eq.${washId}&limit=1`,
      ) as Record<string, unknown>[];
      const selectedWash = rows[0];
      if (!selectedWash) {
        return Response.json({ error: "Không tìm thấy lượt rửa cần chỉnh sửa." }, { status: 404 });
      }

      const cleanWorkItem = String(payload.workItem || "").trim();
      const cleanPrice = Math.max(Number(payload.price) || 0, 0);
      const usedCredit = Boolean(payload.usedCredit);
      const cleanDiscount = usedCredit
        ? cleanPrice
        : Math.min(cleanPrice, Math.max(Number(payload.discount) || 0, 0));
      if (!cleanWorkItem) {
        return Response.json({ error: "Vui lòng nhập hạng mục rửa." }, { status: 400 });
      }

      const vehicleId = Number(selectedWash.vehicle_id || 0);
      const previousUsedCredit = Boolean(selectedWash.used_credit);
      let previousCredits: number | null = null;
      if (vehicleId && previousUsedCredit !== usedCredit) {
        previousCredits = await vehicleWashCredits(vehicleId);
        if (usedCredit && previousCredits < 1) {
          return Response.json({ error: "Xe này không còn lượt rửa miễn phí." }, { status: 400 });
        }
        await setVehicleWashCredits(
          vehicleId,
          previousCredits + (previousUsedCredit ? 1 : -1),
        );
      }

      const existingWorkItem = parsedWorkItem(selectedWash.work_item);
      const storedWorkItem = existingWorkItem.createdByName
        ? workItemWithCreator(cleanWorkItem, existingWorkItem.createdByName)
        : cleanWorkItem;
      try {
        await adminRequest(`parking_washes?id=eq.${washId}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            work_item: storedWorkItem,
            price: cleanPrice,
            discount: cleanDiscount,
            final_amount: cleanPrice - cleanDiscount,
            used_credit: usedCredit,
          }),
        });
      } catch (error) {
        if (vehicleId && previousCredits != null) {
          await setVehicleWashCredits(vehicleId, previousCredits).catch(() => null);
        }
        throw error;
      }
      return Response.json({ ok: true });
    }

    if (action === "updateService" || action === "deleteService") {
      const serviceId = Number(payload.serviceId);
      const rows = await adminRequest(
        `parking_services?select=*&id=eq.${serviceId}&limit=1`,
      ) as Record<string, unknown>[];
      const selectedService = rows[0];
      if (!selectedService) {
        return Response.json({ error: "Không tìm thấy dịch vụ." }, { status: 404 });
      }

      const vehicleId = Number(selectedService.vehicle_id || 0);
      const previousBonus = Number(selectedService.bonus_washes || 0);
      const nextBonus = action === "deleteService"
        ? 0
        : Math.max(Math.trunc(Number(payload.bonusWashes) || 0), 0);
      let previousCredits: number | null = null;
      if (vehicleId && previousBonus !== nextBonus) {
        previousCredits = await vehicleWashCredits(vehicleId);
        await setVehicleWashCredits(vehicleId, previousCredits + nextBonus - previousBonus);
      }

      try {
        if (action === "deleteService") {
          await adminRequest(`parking_services?id=eq.${serviceId}`, {
            method: "DELETE",
            headers: { Prefer: "return=minimal" },
          });
        } else {
          const serviceName = String(payload.serviceName || "").trim();
          const cleanPrice = Math.max(Number(payload.price) || 0, 0);
          const cleanDiscount = Math.min(cleanPrice, Math.max(Number(payload.discount) || 0, 0));
          if (!serviceName) {
            if (vehicleId && previousCredits != null) {
              await setVehicleWashCredits(vehicleId, previousCredits).catch(() => null);
            }
            return Response.json({ error: "Vui lòng nhập tên dịch vụ." }, { status: 400 });
          }
          await adminRequest(`parking_services?id=eq.${serviceId}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              service_name: serviceName,
              price: cleanPrice,
              discount: cleanDiscount,
              final_amount: cleanPrice - cleanDiscount,
              bonus_washes: nextBonus,
              note: String(payload.note || "").trim(),
            }),
          });
        }
      } catch (error) {
        if (vehicleId && previousCredits != null) {
          await setVehicleWashCredits(vehicleId, previousCredits).catch(() => null);
        }
        throw error;
      }
      return Response.json({ ok: true });
    }

    if (action === "updatePayment") {
      const paymentId = Number(payload.paymentId);
      const amount = Math.max(Number(payload.amount) || 0, 0);
      const updated = await adminRequest(`parking_payments?id=eq.${paymentId}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          amount,
          note: String(payload.note || "").trim(),
        }),
      }) as Record<string, unknown>[];
      if (!updated.length) {
        return Response.json({ error: "Không tìm thấy khoản thu." }, { status: 404 });
      }
      return Response.json({ ok: true });
    }

    if (action === "deletePayment") {
      const paymentId = Number(payload.paymentId);
      const rows = await adminRequest(
        `parking_payments?select=*&id=eq.${paymentId}&limit=1`,
      ) as Record<string, unknown>[];
      const selectedPayment = rows[0];
      if (!selectedPayment) {
        return Response.json({ error: "Không tìm thấy khoản thu." }, { status: 404 });
      }
      await adminRequest(`parking_payments?id=eq.${paymentId}`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });

      const vehicleId = Number(selectedPayment.vehicle_id || 0);
      const createdAt = new Date(String(selectedPayment.created_at));
      const now = new Date();
      const isCurrentMonth = createdAt.getFullYear() === now.getFullYear() &&
        createdAt.getMonth() === now.getMonth();
      if (vehicleId && selectedPayment.payment_type === "Tiền tháng" && isCurrentMonth) {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
        const remaining = await adminRequest(
          `parking_payments?select=id&vehicle_id=eq.${vehicleId}` +
          `&payment_type=eq.${encodeURIComponent("Tiền tháng")}` +
          `&created_at=gte.${encodeURIComponent(monthStart)}` +
          `&created_at=lt.${encodeURIComponent(nextMonth)}&limit=1`,
        ) as Record<string, unknown>[];
        if (!remaining.length) {
          await adminRequest(`parking_vehicles?id=eq.${vehicleId}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ month_paid: false }),
          });
        }
      }
      return Response.json({ ok: true });
    }

    if (action === "markNotificationsRead") {
      await adminRequest("parking_notifications?is_read=eq.false", {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ is_read: true }),
      }).catch(() => null);
      return Response.json({ ok: true });
    }

    if (action === "recordWash") {
      const body = {
        p_vehicle_id: payload.vehicleId,
        p_plate: payload.plate,
        p_work_item: payload.workItem,
        p_price: payload.price,
        p_discount: payload.discount,
        p_used_credit: payload.usedCredit,
      };
      try {
        await adminRequest("rpc/parking_record_wash_v2", {
          method: "POST",
          body: JSON.stringify({ ...body, p_created_by: session.userId }),
        });
      } catch (error) {
        const text = error instanceof Error ? error.message : "";
        const isMissingUpgrade = text.includes("parking_record_wash_v2") ||
          text.includes("schema cache") ||
          text.includes("PGRST202");
        if (!isMissingUpgrade) throw error;
        await adminRequest("rpc/parking_record_wash", {
          method: "POST",
          body: JSON.stringify({
            ...body,
            p_work_item: workItemWithCreator(String(payload.workItem || ""), session.fullName),
          }),
        });
      }
      const recentWashes = await adminRequest(
        `parking_washes?select=id&vehicle_id=eq.${Number(payload.vehicleId)}&order=id.desc&limit=1`,
      ).catch(() => []) as Record<string, unknown>[];
      const washId = Number(recentWashes[0]?.id);
      if (washId) {
        await adminRequest(`parking_washes?id=eq.${washId}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            created_by: session.userId,
            created_by_name: session.fullName,
          }),
        }).catch(() => null);
      }
      return Response.json({ ok: true });
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
      deleteWash: {
        name: "parking_delete_wash",
        body: {
          p_wash_id: payload.washId,
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
