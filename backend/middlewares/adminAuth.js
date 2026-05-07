function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (!process.env.ADMIN_TOKEN) {
    return res.status(500).json({
      status: "erro",
      message: "Token administrativo não configurado no servidor."
    });
  }

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({
      status: "erro",
      message: "Acesso administrativo não autorizado."
    });
  }

  next();
}

module.exports = requireAdmin;
