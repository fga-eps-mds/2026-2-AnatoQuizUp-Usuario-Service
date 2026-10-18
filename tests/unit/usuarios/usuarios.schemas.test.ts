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
    expect(schemaSalvarAvatar.safeParse({ corCerebro: "azul", cabelo: "loiro", acessorio: null }).success).toBe(true);
    expect(schemaSalvarAvatar.safeParse({ corCerebro: "invalida", cabelo: null, acessorio: null }).success).toBe(false);
    expect(schemaSalvarAvatar.safeParse({ corCerebro: "azul", cabelo: null, acessorio: null, usuarioId: "outro" }).success).toBe(false);
  });
});
