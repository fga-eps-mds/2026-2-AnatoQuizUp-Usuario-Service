import jwt from "jsonwebtoken";
import request from "supertest";

import { aplicacao } from "@/config/app";
import { prisma } from "@/config/db";
import { env } from "@/config/env";

describe("Avatar: persistencia e limite por aluno", () => {
  const ids: string[] = [];
  const tokens: string[] = [];
  const fixture = `avatar-cota-${process.pid}-${Date.now()}`;
  const avatar = {
    corCerebro: "azul",
    cabelo: "moicano",
    acessorio: "coroa",
    luva: "luva-la",
    calcado: "tenis-cano-alto",
  };
  const padrao = {
    corCerebro: "rosa",
    cabelo: null,
    acessorio: null,
    luva: null,
    calcado: null,
  };

  beforeAll(async () => {
    if (env.NODE_ENV !== "test") throw new Error("Este teste exige NODE_ENV=test.");
    const perfis = ["ALUNO", "ALUNO", "PROFESSOR"] as const;
    for (const [index, perfil] of perfis.entries()) {
      const usuario = await prisma.usuario.create({
        data: {
          nome: `Teste Avatar ${index}`,
          email: `${fixture}-${index}@integration.example`,
          senha: "hash-usado-apenas-no-teste",
          perfil,
          status: "ATIVO",
          visivel: false,
        },
      });
      ids.push(usuario.id);
      tokens.push(jwt.sign({ id: usuario.id, perfil }, env.JWT_SECRET_KEY, { expiresIn: "5m" }));
    }
  });

  afterAll(async () => {
    if (ids.length) await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
  });

  const salvar = (token: string, aparencia = avatar) => request(aplicacao)
    .put("/api/v1/usuarios/meu-avatar")
    .set("X-Internal-Token", env.INTERNAL_TOKEN)
    .set("Authorization", `Bearer ${token}`)
    .send(aparencia);

  const ler = (token: string, rota = "/api/v1/usuarios/meu-avatar") => request(aplicacao)
    .get(rota)
    .set("X-Internal-Token", env.INTERNAL_TOKEN)
    .set("Authorization", `Bearer ${token}`);

  it("mantem cotas independentes para dois alunos vindos do mesmo IP do BFF", async () => {
    // O mesmo cliente usa JWTs diferentes; como no BFF, o IP de origem e comum.
    for (let attempt = 0; attempt < 30; attempt++) {
      await salvar(tokens[0]).expect(200);
    }
    const bloqueio = await salvar(tokens[0]).expect(429);
    expect(bloqueio.headers["retry-after"]).toBeDefined();
    await salvar(tokens[0]).set("X-Forwarded-For", "198.51.100.20").expect(429);
    await salvar(tokens[1]).expect(200);
    expect((await ler(tokens[0]).expect(200)).body.dados).toEqual(avatar);
  }, 15_000);

  it("recupera os cinco campos gravados e permite restaurar o padrao", async () => {
    await salvar(tokens[1]).expect(200);
    expect((await ler(tokens[1]).expect(200)).body.dados).toEqual(avatar);
    expect((await ler(tokens[1], `/api/v1/usuarios/${ids[1]}/avatar`).expect(200)).body.dados)
      .toEqual(avatar);

    await request(aplicacao)
      .put("/api/v1/usuarios/meu-avatar")
      .set("X-Internal-Token", env.INTERNAL_TOKEN)
      .set("Authorization", `Bearer ${tokens[1]}`)
      .send(padrao)
      .expect(200);
    expect((await ler(tokens[1]).expect(200)).body.dados).toEqual(padrao);
    expect((await ler(tokens[0]).expect(200)).body.dados).toEqual(avatar);
  });

  it("exige autenticacao e papel de aluno para gravar", async () => {
    await request(aplicacao)
      .put("/api/v1/usuarios/meu-avatar")
      .set("X-Internal-Token", env.INTERNAL_TOKEN)
      .send(avatar)
      .expect(401);
    await salvar(tokens[2]).expect(403);
  });
});
