import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "src/guards/auth/public.guard";
import { AuthService } from "./auth.service";
import { LoginDTO } from "src/dto/auth/login.dto";
import { CreateUserDTO } from "src/dto/auth/create-user.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({
    default: { limit: 8, ttl: 60 * 1000 },
  })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body() loginDto: LoginDTO) {
    return this.authService.signIn(loginDto);
  }

  // @Public()
  // @HttpCode(HttpStatus.CREATED)
  // @Post("signup")
  // async signup(@Body() createUserDto: CreateUserDTO) {
  //   return this.authService.signUp(createUserDto);
  // }
}
