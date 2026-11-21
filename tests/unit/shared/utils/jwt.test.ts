import jwt from "jsonwebtoken";

import { PAPEIS } from "@/shared/constants/papeis";
import { STATUS } from "@/shared/constants/status";
import {
  jwtSecretKey,
  jwtRefreshSecretKey,
  jwtPasswordRedefinitionSecretKey,
} from "@/config/env";
import type { PayloadAutenticacao } from "@/shared/types/autenticacao.types";
import {
  gerarTokenDeAcesso,
  gerarTokenDeRedefinicaoDeSenha,
  gerarRefreshToken,
  verificarTokenJwt,
} from "@/shared/utils/jwt";

const payload_autenticacao: PayloadAutenticacao = {
  id: "uuid",
  email: "email@domain",
  papel: PAPEIS.ALUNO,
  status: STATUS.ATIVO,
};

describe("Testa utilitários JTW", () => {
  test("Gera token de acesso com sucesso", () => {
    const token: string = gerarTokenDeAcesso(payload_autenticacao, jwtSecretKey);
    const token_verificado: PayloadAutenticacao = jwt.verify(
      token,
      jwtSecretKey,
    ) as PayloadAutenticacao;
    expect(token_verificado.id).toEqual("uuid");
  });

  test("Gera refresh token com sucesso", () => {
    const token: string = gerarRefreshToken(payload_autenticacao, jwtRefreshSecretKey);
    const token_verificado: PayloadAutenticacao = jwt.verify(
      token,
      jwtRefreshSecretKey,
    ) as PayloadAutenticacao;
    expect(token_verificado.id).toEqual("uuid");
  });

  test("Gera token de redefinição de senha com sucesso", () => {
    const token: string = gerarTokenDeRedefinicaoDeSenha(
      payload_autenticacao,
      jwtPasswordRedefinitionSecretKey,
    );
    const token_verificado: PayloadAutenticacao = jwt.verify(
      token,
      jwtPasswordRedefinitionSecretKey,
    ) as PayloadAutenticacao;
    expect(token_verificado.id).toEqual("uuid");
  });

  test("Verifica token válido com sucesso", () => {
    const token = jwt.sign(payload_autenticacao, jwtSecretKey);
    const token_verificado: PayloadAutenticacao = verificarTokenJwt(
      token,
      jwtSecretKey,
    ) as PayloadAutenticacao;
    expect(token_verificado.id).toEqual("uuid");
  });

  test("Lança erro de verificação quando verifica token mal-formado", () => {
    try {
      verificarTokenJwt("token-mal-formado", jwtSecretKey);
    } catch (erro: unknown) {
      const erro_tipado = erro as Error;
      expect(erro_tipado.message).toBe("Token inválido");
    }
  });

  test("Lança erro de verificação quando verifica token expirado", () => {
    const token_expirado = jwt.sign(payload_autenticacao, jwtSecretKey, { expiresIn: "-1s" });
    try {
      verificarTokenJwt(token_expirado, jwtSecretKey);
    } catch (erro: unknown) {
      const erro_tipado = erro as Error;
      expect(erro_tipado.message).toBe("Token expirado");
    }
  });

  test("Lança erro genérico quando a verificação falha por um motivo inesperado", () => {
    const token = jwt.sign(payload_autenticacao, jwtSecretKey);
    const falhaInesperada = new Error("falha inesperada da lib");
    const verifySpy = jest.spyOn(jwt, "verify").mockImplementation(() => {
      throw falhaInesperada;
    });

    try {
      verificarTokenJwt(token, jwtSecretKey);
      throw new Error("verificarTokenJwt deveria ter lançado um erro");
    } catch (erro: unknown) {
      const erro_tipado = erro as Error;
      expect(erro_tipado.message).toBe("Falha na verificação do token");
    } finally {
      verifySpy.mockRestore();
    }
  });
});
