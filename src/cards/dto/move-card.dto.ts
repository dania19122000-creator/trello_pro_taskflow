import { Transform } from "class-transformer";
import { IsInt, IsNotEmpty, IsOptional, Min } from "class-validator";

export class MoveCardDto {
    @IsNotEmpty({ message: 'Column ID is required' })
    @IsInt({ message: 'Column ID must be a number' })
    @Transform(({ value }) => parseInt(value))
    columnId!: number;

    @IsOptional()
    @IsInt({ message: 'Order must be a number' })
    @Min(0, { message: 'Order must be at least 0' })
    @Transform(({ value }) => (value))
    order?: number;
}