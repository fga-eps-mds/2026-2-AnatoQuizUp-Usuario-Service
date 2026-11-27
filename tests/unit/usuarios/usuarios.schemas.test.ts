import {
  schemaBuscarAlunos,
  schemaBuscarUsuarioPorId,
  schemaBuscarUsuariosPorIds,
} from "../../../src/modules/usuarios/usuarios.schemas";

describe("schemas usuarios", () => {
  test("schemaBuscarAlunos converte paginacao e normaliza busca", () => {
    expect(schemaBuscarAlunos.parse({
      busca: " joao ",
      page: "2",
      limit: "20",
    })).toEqual({
      busca: "joao",
      page: 2,
      limit: 20,
    });
  });

  test.each([
    ["busca vazia", { busca: "   " }],
    ["page invalida", { page: "0" }],
    ["limit maior que maximo", { limit: "101" }],
  ])("schemaBuscarAlunos rejeita %s", (_caso, query) => {
    expect(() => schemaBuscarAlunos.parse(query)).toThrow();
  });

  test("schemaBuscarUsuariosPorIds transforma string em lista de ids", () => {
    expect(schemaBuscarUsuariosPorIds.parse({ ids: " aluno-1,aluno-2 " })).toEqual({
      ids: ["aluno-1", "aluno-2"],
    });
  });

  test("schemaBuscarUsuariosPorIds rejeita ids ausentes ou duplicados", () => {
    expect(() => schemaBuscarUsuariosPorIds.parse({})).toThrow();
    expect(() => schemaBuscarUsuariosPorIds.parse({ ids: "aluno-1, aluno-1" })).toThrow();
  });

  test("schemaBuscarUsuarioPorId remove espacos do id", () => {
    expect(schemaBuscarUsuarioPorId.parse({ id: " professor-1 " })).toEqual({
      id: "professor-1",
    });
  });

  test("schemaBuscarUsuarioPorId rejeita id vazio", () => {
    expect(() => schemaBuscarUsuarioPorId.parse({ id: "   " })).toThrow();
    expect(() => schemaBuscarUsuarioPorId.parse({})).toThrow();
  });
});
import { schemaSalvarAvatar } from "../../../src/modules/usuarios/usuarios.schemas";

describe("schemaSalvarAvatar", () => {
  test("aceita apenas as opcoes disponiveis na interface", () => {
    const avatar = { corCerebro: "azul", cabelo: "loiro", acessorio: null, luva: "luva-la", calcado: "tenis-cano-alto" };
    expect(schemaSalvarAvatar.safeParse(avatar).success).toBe(true);
    expect(schemaSalvarAvatar.safeParse({ ...avatar, luva: null, calcado: null }).success).toBe(true);
    expect(schemaSalvarAvatar.safeParse({ ...avatar, luva: "invalida" }).success).toBe(false);
    expect(schemaSalvarAvatar.safeParse({ ...avatar, calcado: "invalido" }).success).toBe(false);
    expect(schemaSalvarAvatar.safeParse({ ...avatar, corCerebro: "invalida" }).success).toBe(false);
    expect(schemaSalvarAvatar.safeParse({ ...avatar, usuarioId: "outro" }).success).toBe(false);
  });
});

describe("schemaSalvarAvatar - itens novos da loja", () => {
  const base = { corCerebro: "rosa", cabelo: null, acessorio: null, luva: null, calcado: null };

  test.each([
    "loiro-castanho", "loiro-ruivo", "cacheado-loiro", "cacheado-castanho", "moicano-loiro",
    "moicano-ruivo", "curto-cacheado", "trancas", "curto-grisalho", "curto-cacheado-loiro",
  ])("aceita o cabelo novo %s", (cabelo) => {
    expect(schemaSalvarAvatar.safeParse({ ...base, cabelo }).success).toBe(true);
  });

  test.each([
    "bone", "tiara", "oculos-sol", "chapeu-festa", "capacete",
    "chapeu-mago", "chapeu-chef", "chapeu-palha", "mascara-carnaval", "chapeu-cowboy",
  ])("aceita o acessorio novo %s", (acessorio) => {
    expect(schemaSalvarAvatar.safeParse({ ...base, acessorio }).success).toBe(true);
  });

  test.each([
    "luva-boxe-azul", "luva-boxe-verde", "luva-boxe-dourado", "luva-boxe-roxo", "luva-boxe-preta",
    "luva-la-rosa", "luva-la-verde", "luva-la-azul", "luva-jardinagem", "luva-goleiro",
  ])("aceita a luva nova %s", (luva) => {
    expect(schemaSalvarAvatar.safeParse({ ...base, luva }).success).toBe(true);
  });

  test.each([
    "tenis-esportivo-vermelho", "tenis-esportivo-verde", "tenis-esportivo-amarelo", "tenis-esportivo-preto",
    "tenis-cano-alto-azul", "tenis-cano-alto-verde", "tenis-cano-alto-amarelo", "tenis-cano-alto-preto",
    "tenis-skate", "bota-coturno",
  ])("aceita o calcado novo %s", (calcado) => {
    expect(schemaSalvarAvatar.safeParse({ ...base, calcado }).success).toBe(true);
  });

  test("aceita os quatro slots novos equipados ao mesmo tempo", () => {
    const avatar = {
      corCerebro: "verde",
      cabelo: "trancas",
      acessorio: "chapeu-cowboy",
      luva: "luva-goleiro",
      calcado: "bota-coturno",
    };
    expect(schemaSalvarAvatar.parse(avatar)).toEqual(avatar);
  });

  test("continua recusando item que nao existe em nenhum tipo", () => {
    expect(schemaSalvarAvatar.safeParse({ ...base, cabelo: "bone" }).success).toBe(false);
    expect(schemaSalvarAvatar.safeParse({ ...base, acessorio: "luva-goleiro" }).success).toBe(false);
  });
});
