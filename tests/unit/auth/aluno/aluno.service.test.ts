import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

import type { AlunoAuthRepository } from "@/modules/auth/aluno/aluno.repository";
import { AlunoAuthService } from "@/modules/auth/aluno/aluno.service";
import { VALOR_NAO_SE_APLICA } from "@/modules/auth/aluno/aluno.constants";
import type { RegistrarAlunoDto } from "@/modules/auth/aluno/dto/registrar.aluno.types";
import { MENSAGENS } from "@/shared/constants/mensagens";
import { CodigoDeErro } from "@/shared/errors/codigos-de-erro";

function criarAlunoAuthRepositoryMock() {
  const buscarPorEmail = jest.fn<AlunoAuthRepository["buscarPorEmail"]>(async () => null);
  const buscarPorNickname = jest.fn<AlunoAuthRepository["buscarPorNickname"]>(async () => null);
  const criar = jest.fn<AlunoAuthRepository["criar"]>(async (data) => ({
    id: "usuario-id",
    nome: data.nome,
    nickname: data.nickname,
    email: data.email,
    instituicao: data.instituicao,
    curso: data.curso,
    periodo: data.periodo,
    semVinculoAcademico:
      data.instituicao === VALOR_NAO_SE_APLICA &&
      data.curso === VALOR_NAO_SE_APLICA &&
      data.periodo === VALOR_NAO_SE_APLICA,
    dataNascimento: data.dataNascimento,
    nacionalidade: data.nacionalidade,
    cidade: data.cidade,
    estado: data.estado,
    escolaridade: data.escolaridade,
    papel: data.papel,
    status: data.status,
    createdAt: new Date("2026-04-25T12:00:00.000Z"),
    updatedAt: new Date("2026-04-25T12:00:00.000Z"),
  }));

  return {
    alunoAuthRepository: {
      buscarPorEmail,
      buscarPorNickname,
      criar,
    } as unknown as AlunoAuthRepository,
    buscarPorEmail,
    buscarPorNickname,
    criar,
  };
}

function criarInputRegistroValido(): RegistrarAlunoDto {
  return {
    nome: "Joao",
    nickname: "joao_junior",
    email: "joao.junior@aluno.unb.br",
    senha: "senha1234",
    confirmacaoSenha: "senha1234",
    instituicao: "Universidade de Brasilia",
    curso: "Medicina",
    periodo: "3",
    dataNascimento: "2003-12-30",
    nacionalidade: "Brasileiro",
    cidade: "Brasilia",
    estado: "DF",
    escolaridade: "GRADUACAO",
  };
}

function criarErroPrismaCampoUnico(campo: "email" | "nickname") {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: [campo] },
  });
}

function criarErroPrismaCampoUnicoComTargetString(campo: "email" | "nickname") {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: campo },
  });
}

function criarErroPrismaCampoUnicoSemTarget() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: {},
  });
}

function criarErroPrismaCampoUnicoPorIndiceSemMensagem() {
  return new Prisma.PrismaClientKnownRequestError("Raw query unique constraint failed", {
    code: "P2010",
    clientVersion: "test",
    meta: { code: "23505" },
  });
}

function criarErroPrismaCampoUnicoPorIndice(campo: "email" | "nickname") {
  return new Prisma.PrismaClientKnownRequestError("Raw query unique constraint failed", {
    code: "P2010",
    clientVersion: "test",
    meta: {
      code: "23505",
      message: `duplicate key value violates unique constraint "usuarios_${campo}_key"`,
    },
  });
}

describe("AlunoAuthService", () => {
  it("cadastra aluno com todos os campos, senha hasheada e perfil ALUNO/ATIVO", async () => {
    const { alunoAuthRepository, buscarPorEmail, buscarPorNickname, criar } =
      criarAlunoAuthRepositoryMock();
    const service = new AlunoAuthService(alunoAuthRepository);

    const resposta = await service.registrar({
      nome: "  Joao   da Silva Junior  ",
      nickname: " Joao_Junior ",
      email: "JOAO.JUNIOR@ALUNO.UNB.BR",
      senha: "senha1234",
      confirmacaoSenha: "senha1234",
      instituicao: " Universidade   de Brasilia ",
      curso: " Medicina ",
      periodo: " 3 ",
      dataNascimento: "2003-12-30",
      nacionalidade: " Brasileiro ",
      cidade: " Brasilia ",
      estado: "DF",
      escolaridade: "GRADUACAO",
    });

    const dadosCriacao = criar.mock.calls[0]?.[0];

    expect(buscarPorEmail).toHaveBeenCalledWith("joao.junior@aluno.unb.br");
    expect(buscarPorNickname).toHaveBeenCalledWith("joao_junior");
    expect(dadosCriacao).toBeDefined();

    if (!dadosCriacao) {
      throw new Error("Dados de criacao nao capturados.");
    }

    expect(dadosCriacao.nome).toBe("Joao da Silva Junior");
    expect(dadosCriacao.nickname).toBe("joao_junior");
    expect(dadosCriacao.email).toBe("joao.junior@aluno.unb.br");
    expect(dadosCriacao.instituicao).toBe("Universidade de Brasilia");
    expect(dadosCriacao.curso).toBe("Medicina");
    expect(dadosCriacao.periodo).toBe("3");
    expect(dadosCriacao.dataNascimento.toISOString().slice(0, 10)).toBe("2003-12-30");
    expect(dadosCriacao.nacionalidade).toBe("Brasileiro");
    expect(dadosCriacao.cidade).toBe("Brasilia");
    expect(dadosCriacao.estado).toBe("DF");
    expect(dadosCriacao.escolaridade).toBe("GRADUACAO");
    expect(dadosCriacao.papel).toBe("ALUNO");
    expect(dadosCriacao.status).toBe("ATIVO");
    expect(dadosCriacao.senhaHash).not.toBe("senha1234");
    expect(dadosCriacao.senhaHash).toContain("$10$");
    await expect(bcrypt.compare("senha1234", dadosCriacao.senhaHash)).resolves.toBe(true);
    expect(resposta).not.toHaveProperty("senha");
    expect(resposta).not.toHaveProperty("senhaHash");
    expect(resposta.nickname).toBe("joao_junior");
    expect(resposta.dataNascimento).toBe("2003-12-30");
  });

  it("aceita Nao se aplica como valor literal para dados academicos", async () => {
    const { alunoAuthRepository, criar } = criarAlunoAuthRepositoryMock();
    const service = new AlunoAuthService(alunoAuthRepository);

    const resposta = await service.registrar({
      nome: "Maria",
      nickname: "maria",
      email: "maria@aluno.unb.br",
      senha: "senha1234",
      confirmacaoSenha: "senha1234",
      instituicao: VALOR_NAO_SE_APLICA,
      curso: VALOR_NAO_SE_APLICA,
      periodo: VALOR_NAO_SE_APLICA,
      dataNascimento: "2003-12-30",
      nacionalidade: "Brasileira",
      cidade: "Brasilia",
      estado: "DF",
      escolaridade: "ENSINO_MEDIO",
    });

    const dadosCriacao = criar.mock.calls[0]?.[0];

    expect(dadosCriacao?.instituicao).toBe(VALOR_NAO_SE_APLICA);
    expect(dadosCriacao?.curso).toBe(VALOR_NAO_SE_APLICA);
    expect(dadosCriacao?.periodo).toBe(VALOR_NAO_SE_APLICA);
    expect(resposta.semVinculoAcademico).toBe(true);
  });

  it("retorna conflito quando email ja esta cadastrado", async () => {
    const { alunoAuthRepository, buscarPorEmail, criar } = criarAlunoAuthRepositoryMock();
    buscarPorEmail.mockResolvedValue({
      id: "usuario-existente",
      email: "joao.junior@aluno.unb.br",
    });
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(
      service.registrar({
        nome: "Joao",
        nickname: "joao_junior",
        email: "joao.junior@aluno.unb.br",
        senha: "senha1234",
        confirmacaoSenha: "senha1234",
        instituicao: "Universidade de Brasilia",
        curso: "Medicina",
        periodo: "3",
        dataNascimento: "2003-12-30",
        nacionalidade: "Brasileiro",
        cidade: "Brasilia",
        estado: "DF",
        escolaridade: "GRADUACAO",
      }),
    ).rejects.toMatchObject({
      codigoStatus: 409,
      codigo: CodigoDeErro.CONFLITO,
      message: MENSAGENS.emailJaCadastrado,
    });
    expect(criar).not.toHaveBeenCalled();
  });

  it("retorna conflito quando nickname ja esta cadastrado", async () => {
    const { alunoAuthRepository, buscarPorNickname, criar } = criarAlunoAuthRepositoryMock();
    buscarPorNickname.mockResolvedValue({
      id: "usuario-existente",
      nickname: "joao_junior",
    });
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(
      service.registrar({
        nome: "Joao",
        nickname: "joao_junior",
        email: "joao.junior@aluno.unb.br",
        senha: "senha1234",
        confirmacaoSenha: "senha1234",
        instituicao: "Universidade de Brasilia",
        curso: "Medicina",
        periodo: "3",
        dataNascimento: "2003-12-30",
        nacionalidade: "Brasileiro",
        cidade: "Brasilia",
        estado: "DF",
        escolaridade: "GRADUACAO",
      }),
    ).rejects.toMatchObject({
      codigoStatus: 409,
      codigo: CodigoDeErro.CONFLITO,
      message: MENSAGENS.nicknameJaCadastrado,
    });
    expect(criar).not.toHaveBeenCalled();
  });

  it("verifica disponibilidade de nickname", async () => {
    const { alunoAuthRepository, buscarPorNickname } = criarAlunoAuthRepositoryMock();
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(
      service.verificarNicknameDisponivel({ nickname: " Joao_Junior " }),
    ).resolves.toEqual({
      nickname: "joao_junior",
      disponivel: true,
    });

    expect(buscarPorNickname).toHaveBeenCalledWith("joao_junior");
  });

  it("indica nickname indisponivel quando ja existe", async () => {
    const { alunoAuthRepository, buscarPorNickname } = criarAlunoAuthRepositoryMock();
    buscarPorNickname.mockResolvedValue({
      id: "usuario-existente",
      nickname: "joao_junior",
    });
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(service.verificarNicknameDisponivel({ nickname: "joao_junior" })).resolves.toEqual(
      {
        nickname: "joao_junior",
        disponivel: false,
      },
    );
  });
  it("verifica disponibilidade de email", async () => {
    const { alunoAuthRepository, buscarPorEmail } = criarAlunoAuthRepositoryMock();
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(
      service.verificarEmailDisponivel({ email: " JOAO.JUNIOR@ALUNO.UNB.BR " }),
    ).resolves.toEqual({
      email: "joao.junior@aluno.unb.br",
      disponivel: true,
    });

    expect(buscarPorEmail).toHaveBeenCalledWith("joao.junior@aluno.unb.br");
  });

  it("indica email indisponivel quando ja existe", async () => {
    const { alunoAuthRepository, buscarPorEmail } = criarAlunoAuthRepositoryMock();
    buscarPorEmail.mockResolvedValue({
      id: "usuario-existente",
      email: "joao.junior@aluno.unb.br",
    });
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(
      service.verificarEmailDisponivel({ email: "joao.junior@aluno.unb.br" }),
    ).resolves.toEqual({
      email: "joao.junior@aluno.unb.br",
      disponivel: false,
    });
  });

  it("converte conflito unico de email do banco em erro 409", async () => {
    const { alunoAuthRepository, criar } = criarAlunoAuthRepositoryMock();
    criar.mockRejectedValue(criarErroPrismaCampoUnico("email"));
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(service.registrar(criarInputRegistroValido())).rejects.toMatchObject({
      codigoStatus: 409,
      codigo: CodigoDeErro.CONFLITO,
      message: MENSAGENS.emailJaCadastrado,
      detalhes: { email: "joao.junior@aluno.unb.br" },
    });
  });

  it("converte conflito unico de email quando o target do prisma nao e um array", async () => {
    const { alunoAuthRepository, criar } = criarAlunoAuthRepositoryMock();
    criar.mockRejectedValue(criarErroPrismaCampoUnicoComTargetString("email"));
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(service.registrar(criarInputRegistroValido())).rejects.toMatchObject({
      codigoStatus: 409,
      codigo: CodigoDeErro.CONFLITO,
      message: MENSAGENS.emailJaCadastrado,
      detalhes: { email: "joao.junior@aluno.unb.br" },
    });
  });

  it("propaga erro P2002 sem target no meta (nao reconhece duplicidade)", async () => {
    const { alunoAuthRepository, criar } = criarAlunoAuthRepositoryMock();
    const erro = criarErroPrismaCampoUnicoSemTarget();
    criar.mockRejectedValue(erro);
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(service.registrar(criarInputRegistroValido())).rejects.toBe(erro);
  });

  it("propaga erro P2010 sem mensagem no meta (nao reconhece duplicidade)", async () => {
    const { alunoAuthRepository, criar } = criarAlunoAuthRepositoryMock();
    const erro = criarErroPrismaCampoUnicoPorIndiceSemMensagem();
    criar.mockRejectedValue(erro);
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(service.registrar(criarInputRegistroValido())).rejects.toBe(erro);
  });

  it("propaga erro prisma que nao e de unicidade (nem P2002 nem P2010)", async () => {
    const { alunoAuthRepository, criar } = criarAlunoAuthRepositoryMock();
    const erro = new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
      code: "P2003",
      clientVersion: "test",
    });
    criar.mockRejectedValue(erro);
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(service.registrar(criarInputRegistroValido())).rejects.toBe(erro);
  });

  it("converte conflito unico de nickname do banco em erro 409", async () => {
    const { alunoAuthRepository, criar } = criarAlunoAuthRepositoryMock();
    criar.mockRejectedValue(criarErroPrismaCampoUnicoPorIndice("nickname"));
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(service.registrar(criarInputRegistroValido())).rejects.toMatchObject({
      codigoStatus: 409,
      codigo: CodigoDeErro.CONFLITO,
      message: MENSAGENS.nicknameJaCadastrado,
      detalhes: { nickname: "joao_junior" },
    });
  });

  it("propaga erro inesperado retornado pelo repositorio", async () => {
    const { alunoAuthRepository, criar } = criarAlunoAuthRepositoryMock();
    const erro = new Error("falha inesperada");
    criar.mockRejectedValue(erro);
    const service = new AlunoAuthService(alunoAuthRepository);

    await expect(service.registrar(criarInputRegistroValido())).rejects.toBe(erro);
  });
});
