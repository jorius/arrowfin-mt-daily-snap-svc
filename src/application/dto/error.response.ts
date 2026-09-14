import { ApiProperty } from '@nestjs/swagger';

/** Shape of every non-2xx body (NestJS default exception filter). */
export class ErrorResponse {
  @ApiProperty({ example: 401 })
  statusCode!: number;

  @ApiProperty({ example: 'Missing or invalid API key' })
  message!: string;

  @ApiProperty({ example: 'Unauthorized', required: false })
  error?: string;
}
