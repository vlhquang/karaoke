const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateRoomCode = (): string => {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return code;
};
