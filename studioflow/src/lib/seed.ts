import type { Store } from "@/types";
import { format, addDays } from "date-fns";
import { businessToday } from "@/lib/utils";
export const DEMO_BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
export const DEMO_TENANT_ID = "22222222-2222-4222-8222-222222222222";
// Demo photos are served from public/demo so the demo works offline and in production.
const photo = (name: string) => `/demo/${name}.jpg`;
export const images = {
  cover: photo("cover"),
  ambience: photo("ambiente"),
  cut: photo("cut"),
  beard: photo("beard"),
  combo: photo("combo"),
  brows: photo("brows"),
  child: photo("child"),
  lucas: photo("lucas"),
  joao: photo("joao"),
  rafael: photo("rafael"),
  ana: photo("ana"),
};
export function createSeed(): Store {
  const businessId = DEMO_BUSINESS_ID;
  // Demo dates follow the business calendar (São Paulo), not the server clock.
  const today = businessToday();
  const day = format(today, "yyyy-MM-dd");
  const uid = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const professionals = [
    {
      id: uid(1),
      businessId,
      name: "Lucas Henrique",
      photo: images.lucas,
      phone: "11987654321",
      specialties: ["Cortes clássicos", "Barba"],
      commission: 40,
      active: true,
      days: [1, 2, 3, 4, 5, 6],
      start: "09:00",
      end: "20:00",
      breakStart: "12:00",
      breakEnd: "13:00",
    },
    {
      id: uid(2),
      businessId,
      name: "João Pedro",
      photo: images.joao,
      phone: "11987654322",
      specialties: ["Degradê", "Pigmentação"],
      commission: 40,
      active: true,
      days: [1, 2, 3, 4, 5, 6],
      start: "09:00",
      end: "20:00",
      breakStart: "12:00",
      breakEnd: "13:00",
    },
    {
      id: uid(3),
      businessId,
      name: "Rafael Lima",
      photo: images.rafael,
      phone: "11987654323",
      specialties: ["Cortes modernos", "Barba"],
      commission: 35,
      active: true,
      days: [1, 2, 3, 4, 5, 6],
      start: "09:00",
      end: "20:00",
      breakStart: "12:00",
      breakEnd: "13:00",
    },
    {
      id: uid(4),
      businessId,
      name: "Ana Clara",
      photo: images.ana,
      phone: "11987654324",
      specialties: ["Sobrancelhas", "Corte infantil"],
      commission: 35,
      active: true,
      days: [1, 2, 3, 4, 5, 6],
      start: "09:00",
      end: "19:00",
      breakStart: "12:00",
      breakEnd: "13:00",
    },
  ];
  const serviceDefs = [
    [
      "Corte masculino",
      "Cabelo",
      40,
      45,
      images.cut,
      "Seu estilo, com acabamento impecável.",
    ],
    [
      "Barba",
      "Barba",
      30,
      30,
      images.beard,
      "Modelagem, toalha quente e cuidado.",
    ],
    [
      "Corte + barba",
      "Combos",
      60,
      65,
      images.combo,
      "Uma experiência completa de cuidado.",
    ],
    [
      "Sobrancelha",
      "Estética",
      20,
      25,
      images.brows,
      "Design natural e acabamento preciso.",
    ],
    [
      "Pigmentação",
      "Cabelo",
      40,
      50,
      images.cut,
      "Mais definição e um visual renovado.",
    ],
    [
      "Corte infantil",
      "Cabelo",
      40,
      40,
      images.child,
      "Um momento tranquilo para os pequenos.",
    ],
  ] as const;
  const services = serviceDefs.map((s, i) => ({
    id: uid(10 + i),
    businessId,
    name: s[0],
    category: s[1],
    duration: s[2],
    price: s[3],
    image: s[4],
    description: s[5],
    active: true,
    professionalIds:
      i === 3
        ? [uid(1), uid(4)]
        : i === 5
          ? [uid(1), uid(4)]
          : [uid(1), uid(2), uid(3)],
  }));
  const names = [
    "Carlos Henrique",
    "Rafael Santos",
    "Matheus Silva",
    "Gabriel Oliveira",
    "Bruno Costa",
    "Felipe Almeida",
    "Amanda Souza",
    "Pedro Lucas",
    "André Ferreira",
    "Thiago Martins",
    "Juliana Alves",
    "Gustavo Rocha",
    "Diego Santos",
    "Patrícia Gomes",
    "Leonardo Lima",
    "Vinícius Melo",
  ];
  const customers = names.map((name, i) => ({
    id: uid(100 + i),
    businessId,
    name,
    phone: `119${String(80000000 + i * 13031).slice(0, 8)}`,
    email: `${name.split(" ")[0].toLowerCase()}@exemplo.com`,
    visits: i === 15 ? 1 : 3 + ((i * 7) % 18),
    totalSpent: 180 + ((i * 95) % 1300),
    lastVisit: format(
      addDays(today, -(i === 7 ? 38 : 3 + i * 2)),
      "yyyy-MM-dd",
    ),
    favoriteService: services[i % 6].name,
    favoriteProfessional: professionals[i % 4].name,
    returnInterval: 20,
    createdAt: format(
      addDays(today, i === 15 ? 0 : -90 - i),
      "yyyy-MM-dd",
    ),
  }));
  const times = [
    "09:00",
    "09:00",
    "09:40",
    "10:00",
    "10:30",
    "11:00",
    "11:10",
    "13:00",
    "13:40",
    "14:00",
    "14:40",
    "15:00",
    "16:00",
    "17:30",
  ];
  const appointments = times.map((time, i) => {
    const service = services[i % 6];
    const start = new Date(`${day}T${time}:00-03:00`);
    const end = new Date(start.getTime() + service.duration * 60000);
    return {
      id: uid(200 + i),
      businessId,
      customerId: customers[i].id,
      customerName: customers[i].name,
      customerPhone: customers[i].phone,
      serviceIds: [service.id],
      professionalId:
        i % 6 === 3 || i % 6 === 5
          ? professionals[3].id
          : professionals[i % 3].id,
      start: start.toISOString(),
      end: end.toISOString(),
      price: service.price,
      status: (i < 4
        ? "completed"
        : i === 4
          ? "in_progress"
          : i === 11
            ? "pending"
            : "confirmed") as Store["appointments"][number]["status"],
      reminder: true,
      createdAt: start.toISOString(),
    };
  });
  const history = Array.from({ length: 50 }, (_, i) => {
    const service = services[i % 6],
      customer = customers[i % 16];
    const start = new Date(
      `${format(addDays(today, -(1 + Math.floor(i / 3))), "yyyy-MM-dd")}T${9 + (i % 8)}:00:00-03:00`.replace(
        /T(\d):/,
        "T0$1:",
      ),
    );
    return {
      id: uid(300 + i),
      businessId,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      serviceIds: [service.id],
      professionalId: professionals[i % 6 === 3 || i % 6 === 5 ? 3 : i % 3].id,
      start: start.toISOString(),
      end: new Date(start.getTime() + service.duration * 60000).toISOString(),
      price: service.price,
      status: "completed" as const,
      reminder: false,
      createdAt: start.toISOString(),
    };
  });
  const payments = [
    ...appointments.filter((a) => a.status === "completed"),
    ...history,
  ].map((a, i) => ({
    id: uid(500 + i),
    businessId,
    appointmentId: a.id,
    amount: a.price,
    method: (["pix", "credit", "cash", "debit"] as const)[i % 4],
    createdAt: a.end,
  }));
  return {
    business: {
      id: businessId,
      tenantId: DEMO_TENANT_ID,
      slug: "barber-011",
      name: "BARBER 011",
      category: "Barbearia",
      description:
        "Corte, barba e cuidado sem pressa, no coração da Consolação.",
      address: "Rua Augusta, 1.420 · Consolação, São Paulo – SP",
      phone: "11987654321",
      instagram: "barber011",
      cover: images.cover,
      photos: [images.ambience, images.cover],
      amenities: ["Wi-Fi", "Bebidas", "Estacionamento", "Climatizado"],
    },
    professionals,
    services,
    customers,
    appointments: [...appointments, ...history],
    payments,
    blockedTimes: [],
    settings: {
      businessId,
      minNotice: 30,
      maxDays: 60,
      buffer: 0,
      cancellationHours: 2,
      openDays: [1, 2, 3, 4, 5, 6],
      openStart: "09:00",
      openEnd: "20:00",
      notifications: true,
    },
  };
}
