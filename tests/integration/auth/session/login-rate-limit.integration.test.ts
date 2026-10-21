import express from "express";
import type { Request, Response } from "express";
import request from "supertest";

import { sessaoRouter } from "@/modules/auth/sessao/sessao.routes";
import { middlewareTratamentoErros } from "@/shared/middlewares/tratamento-erros.middleware";

const mockLogin = jest.fn((_request: Request, response: Response) =>
  response.status(200).json({ dados: { accessToken: "test-only" } }),
);

jest.mock("@/modules/auth/sessao/sessao.controller", () => ({
  SessaoController: jest.fn().mockImplementation(() => ({
    login: (req: Request, res: Response) => mockLogin(req, res),
    renovarSessao: jest.fn(),
    obterUsuarioAutenticado: jest.fn(),
    logout: jest.fn(),
  })),
}));

describe("Limite de tentativas de login", () => {
  it("desconta sucessos, normaliza a conta e nao agrupa usuarios pelo IP do BFF", async () => {
    const app = express();
    app.use(express.json());
    app.use("/sessao", sessaoRouter);
    app.use(middlewareTratamentoErros);
    const login = { email: "aluno@example.com", senha: "senha-de-teste" };

    for (let attempt = 0; attempt < 35; attempt++) {
      await request(app).post("/sessao/login").send(login).expect(200);
    }

    mockLogin.mockImplementation((_req, res) =>
      res.status(401).json({ erro: { codigo: "NAO_AUTORIZADO" } }),
    );
    for (let attempt = 0; attempt < 30; attempt++) {
      await request(app).post("/sessao/login").send(login).expect(401);
    }

    const blocked = await request(app)
      .post("/sessao/login")
      .send({ ...login, email: "  ALUNO@EXAMPLE.COM  " })
      .expect(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.body.erro.codigo).toBe("REQUISICAO_INVALIDA");
    expect(mockLogin).toHaveBeenCalledTimes(65);

    await request(app)
      .post("/sessao/login")
      .send({ ...login, email: "outro@example.com" })
      .expect(401);
    expect(mockLogin).toHaveBeenCalledTimes(66);

    await request(app)
      .post("/sessao/login")
      .send({ email: "invalido", senha: "senha-de-teste" })
      .expect(400);
    expect(mockLogin).toHaveBeenCalledTimes(66);
  });
});
