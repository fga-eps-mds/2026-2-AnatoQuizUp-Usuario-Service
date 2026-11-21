import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { prisma } from "@/config/db";
import { jwtSecretKey } from "@/config/env";
import { PAPEIS } from "@/shared/constants/papeis";
import { STATUS } from "@/shared/constants/status";
import type { Status } from "@/shared/constants/status";
import type { ErroAplicacao } from "@/shared/errors/erro-aplicacao";
import { middlewareAutenticacao } from "@/shared/middlewares/autenticacao.middleware";
import type { PayloadAutenticacao } from "@/shared/types/autenticacao.types";
import { gerarTokenDeAcesso } from "@/shared/utils/jwt";

jest.mock("@/config/db", () => ({
  prisma: {
    usuario: {
      findUnique: jest.fn(),
    },
  },
}));

type MockRequest = Partial<Request> & {
  headers: Request["headers"];
  originalUrl: string;
  path: string;
  url: string;
};

type UsuarioBanco = {
  id: string;
  email: string;
  perfil: string;
  status: Status;
  excluidoEm: Date | null;
};

const findUniqueMock = prisma.usuario.findUnique as unknown as jest.MockedFunction<
  (args: unknown) => Promise<UsuarioBanco | null>
>;

const gerarPayloadAutenticacao = (): PayloadAutenticacao => ({
  id: "usuario-id",
  email: "email@domain.com",
  papel: PAPEIS.ALUNO,
  status: STATUS.ATIVO,
});

const gerarUsuarioBanco = (status: Status = STATUS.ATIVO): UsuarioBanco => ({
  id: "usuario-id",
  email: "email@domain.com",
  perfil: PAPEIS.ALUNO,
  status,
  excluidoEm: null,
});

describe("middlewareAutenticacao", () => {
  let request: MockRequest;
  let response: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    request = {
      headers: {},
      originalUrl: "/api/v1/exemplos",
      path: "/exemplos",
      url: "/exemplos",
    };
    response = {};
    next = jest.fn();
    findUniqueMock.mockReset();
  });

  async function executarMiddleware() {
    await middlewareAutenticacao(request as Request, response as Response, next);
  }

  test("extrai payload correto quando token e usuario ativo sao validos", async () => {
    const token = gerarTokenDeAcesso(gerarPayloadAutenticacao());
    request.headers = { authorization: `Bearer ${token}` };
    findUniqueMock.mockResolvedValue(gerarUsuarioBanco(STATUS.ATIVO));

    await executarMiddleware();

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: "usuario-id" },
      select: {
        id: true,
        email: true,
        perfil: true,
        status: true,
        excluidoEm: true,
      },
    });
    expect(request.user).toEqual({
      userId: "usuario-id",
      email: "email@domain.com",
      role: PAPEIS.ALUNO,
    });
    expect(request.usuario).toEqual({
      id: "usuario-id",
      email: "email@domain.com",
      papel: PAPEIS.ALUNO,
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("ignora autenticacao para rota publica", async () => {
    request.path = "/autenticacao/login";
    request.originalUrl = "/api/v1/autenticacao/login";
    request.url = "/autenticacao/login";

    await executarMiddleware();

    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("normaliza /api/v1 sem sufixo para a raiz e nao trata como rota publica", async () => {
    request.originalUrl = "/api/v1";
    const token = gerarTokenDeAcesso(gerarPayloadAutenticacao());
    request.headers = { authorization: `Bearer ${token}` };
    findUniqueMock.mockResolvedValue(gerarUsuarioBanco(STATUS.ATIVO));

    await executarMiddleware();

    expect(findUniqueMock).toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("trata originalUrl/url ausentes como caminho vazio e segue autenticando normalmente", async () => {
    request.originalUrl = undefined as unknown as string;
    request.url = undefined as unknown as string;
    const token = gerarTokenDeAcesso(gerarPayloadAutenticacao());
    request.headers = { authorization: `Bearer ${token}` };
    findUniqueMock.mockResolvedValue(gerarUsuarioBanco(STATUS.ATIVO));

    await executarMiddleware();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("retorna 401 quando token nao e fornecido", async () => {
    await expect(executarMiddleware()).rejects.toMatchObject<Partial<ErroAplicacao>>({
      message: "Token não fornecido",
      codigoStatus: 401,
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("retorna 401 quando cabecalho authorization nao usa Bearer", async () => {
    request.headers = { authorization: "token-invalido" };

    await expect(executarMiddleware()).rejects.toMatchObject<Partial<ErroAplicacao>>({
      message: "Token inválido",
      codigoStatus: 401,
    });
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("retorna 401 quando token esta expirado", async () => {
    const token = jwt.sign(gerarPayloadAutenticacao(), jwtSecretKey, { expiresIn: "-1s" });
    request.headers = { authorization: `Bearer ${token}` };

    await expect(executarMiddleware()).rejects.toMatchObject<Partial<ErroAplicacao>>({
      message: "Token expirado",
      codigoStatus: 401,
    });
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("retorna 401 quando token tem assinatura invalida", async () => {
    const token = jwt.sign(gerarPayloadAutenticacao(), "segredo-errado");
    request.headers = { authorization: `Bearer ${token}` };

    await expect(executarMiddleware()).rejects.toMatchObject<Partial<ErroAplicacao>>({
      message: "Token inválido",
      codigoStatus: 401,
    });
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("retorna 401 quando usuario do token nao existe mais", async () => {
    const token = gerarTokenDeAcesso(gerarPayloadAutenticacao());
    request.headers = { authorization: `Bearer ${token}` };
    findUniqueMock.mockResolvedValue(null);

    await expect(executarMiddleware()).rejects.toMatchObject<Partial<ErroAplicacao>>({
      message: "Token inválido",
      codigoStatus: 401,
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("retorna 403 quando usuario esta pendente no banco", async () => {
    const token = gerarTokenDeAcesso(gerarPayloadAutenticacao());
    request.headers = { authorization: `Bearer ${token}` };
    findUniqueMock.mockResolvedValue(gerarUsuarioBanco(STATUS.PENDENTE));

    await expect(executarMiddleware()).rejects.toMatchObject<Partial<ErroAplicacao>>({
      message: "Cadastro em análise",
      codigoStatus: 403,
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("retorna 403 quando usuario esta inativo no banco", async () => {
    const token = gerarTokenDeAcesso(gerarPayloadAutenticacao());
    request.headers = { authorization: `Bearer ${token}` };
    findUniqueMock.mockResolvedValue(gerarUsuarioBanco(STATUS.INATIVO));

    await expect(executarMiddleware()).rejects.toMatchObject<Partial<ErroAplicacao>>({
      message: "Conta desativada",
      codigoStatus: 403,
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("retorna 403 quando usuario esta recusado no banco", async () => {
    const token = gerarTokenDeAcesso(gerarPayloadAutenticacao());
    request.headers = { authorization: `Bearer ${token}` };
    findUniqueMock.mockResolvedValue(gerarUsuarioBanco(STATUS.RECUSADO));

    await expect(executarMiddleware()).rejects.toMatchObject<Partial<ErroAplicacao>>({
      message: "Cadastro recusado",
      codigoStatus: 403,
    });
    expect(next).not.toHaveBeenCalled();
  });
});
