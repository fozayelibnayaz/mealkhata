export const people = [
  {
    id: "rafi",
    name: "Rafi Ahmed",
    initial: "RA",
    color: "#e7ebe3",
    old: 42,
    deposit: 4200,
  },
  {
    id: "sakib",
    name: "Sakib Hasan",
    initial: "SH",
    color: "#f2e4cf",
    old: 40,
    deposit: 3500,
  },
  {
    id: "tanvir",
    name: "Tanvir Islam",
    initial: "TI",
    color: "#dfe8f1",
    old: 38,
    deposit: 3000,
  },
  {
    id: "fahim",
    name: "Fahim Rahman",
    initial: "FR",
    color: "#ece2ee",
    old: 43,
    deposit: 3800,
  },
  {
    id: "naim",
    name: "Naim Hossain",
    initial: "NH",
    color: "#e2ebde",
    old: 35,
    deposit: 3200,
  },
  {
    id: "arif",
    name: "Arif Mahmud",
    initial: "AM",
    color: "#f3dfd7",
    old: 41,
    deposit: 3500,
  },
];
export type Expense = {
  id: string;
  title: string;
  amount: number;
  payer: string;
  fund: "fund" | "personal";
  date: string;
  category: string;
};
export type Data = {
  meals: Record<string, number[]>;
  guests: Record<string, number>;
  expenses: Expense[];
};
export const initial: Data = {
  meals: {
    rafi: [1, 1, 1],
    sakib: [1, 1, 0],
    tanvir: [0, 1, 1],
    fahim: [1, 1, 1],
    naim: [0, 1, 0],
    arif: [1, 1, 1],
  },
  guests: {},
  expenses: [
    {
      id: "1",
      title: "Rice, lentils & cooking essentials",
      amount: 890000,
      payer: "sakib",
      fund: "fund",
      date: "2026-09-03",
      category: "Groceries",
    },
    {
      id: "2",
      title: "Weekly vegetables & fish",
      amount: 420000,
      payer: "tanvir",
      fund: "fund",
      date: "2026-09-10",
      category: "Groceries",
    },
    {
      id: "3",
      title: "Chicken, eggs & potatoes",
      amount: 185000,
      payer: "rafi",
      fund: "personal",
      date: "2026-09-17",
      category: "Groceries",
    },
    {
      id: "4",
      title: "Fresh vegetables",
      amount: 68000,
      payer: "sakib",
      fund: "fund",
      date: "2026-09-18",
      category: "Groceries",
    },
    {
      id: "5",
      title: "Fish & spices",
      amount: 124000,
      payer: "fahim",
      fund: "fund",
      date: "2026-09-19",
      category: "Groceries",
    },
  ],
};
