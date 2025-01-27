import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "src/guards/auth/public.guard";
import { AuthService } from "./auth.service";
import { LoginDTO } from "src/dto/auth/login.dto";
import { CreateUserDTO } from "src/dto/auth/create-user.dto";

@Controller("auth")
/**
 * Controller responsible for handling authentication-related requests.
 */
export class AuthController {
  /**
   * Constructs an instance of AuthController.
   * @param authService - The authentication service used to handle authentication logic.
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * Handles user login requests.
   * 
   * @param loginDto - Data Transfer Object containing login credentials.
   * @returns A promise that resolves with the authentication result.
   */
  @Throttle({
    default: { limit: 8, ttl: 60 * 1000 },
  })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post("login")
  login(@Body() loginDto: LoginDTO) {
    return this.authService.signIn(loginDto);
  }

  /**
   * Handles user signup requests.
   * 
   * @param createUserDto - Data Transfer Object containing user registration details.
   * @returns A promise that resolves with the registration result.
   */
  @HttpCode(HttpStatus.CREATED)
  @Post("signup")
  async signup(@Body() createUserDto: CreateUserDTO) {
    return this.authService.signUp(createUserDto);
  }
}
