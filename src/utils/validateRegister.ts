import { UsernamePasswordInput } from "../resolvers/usernameAndPassword";

export const validateRegister = (options: UsernamePasswordInput) => {
  if (!options.email.includes("@")) {
    return [
      {
        field: "email",
        message: "Please use a valid email",
      },
    ];
  }
  if (options.username.length <= 2) {
    return [
      {
        field: "username",
        message: "Username needs to be at least 3 characters long",
      },
    ];
  }
  if (options.username.includes("@")) {
    return [
      {
        field: "username",
        message: "You can't have '@' in your username",
      },
    ];
  }

  if (options.password.length <= 2) {
    return [
      {
        field: "password",
        message: "Password needs to be at least 3 characters long",
      },
    ];
  }

  return null;
};
