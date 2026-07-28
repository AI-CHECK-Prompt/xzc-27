import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string): Promise<{ accessToken: string; user: User }> {
    const user = await this.userRepository.findOneBy({ username });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error('Invalid credentials');
    }

    const payload = { username: user.username, sub: user.id, role: user.role };
    
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.sanitizeUser(user),
    };
  }

  async register(username: string, password: string, email: string): Promise<User> {
    const existingUser = await this.userRepository.findOneBy({ username });
    if (existingUser) {
      throw new Error('Username already exists');
    }

    const existingEmail = await this.userRepository.findOneBy({ email });
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      email,
      role: UserRole.USER,
    });

    return this.sanitizeUser(await this.userRepository.save(user));
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new Error('User not found');
    }
    return this.sanitizeUser(user);
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    // In a real implementation, this would validate the refresh token
    // and generate a new access token
    try {
      const payload = this.jwtService.verify(refreshToken);
      const newPayload = { username: payload.username, sub: payload.sub, role: payload.role };
      return {
        accessToken: this.jwtService.sign(newPayload),
      };
    } catch {
      throw new Error('Invalid refresh token');
    }
  }

  private sanitizeUser(user: User): Partial<User> {
    return JSON.parse(JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    }));
  }
}