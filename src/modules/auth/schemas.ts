import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

export const registerSchema = z.object({
  nomeEmpresa: z.string().min(2, "Informe o nome da empresa/fazenda"),
  nome: z.string().min(2, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
