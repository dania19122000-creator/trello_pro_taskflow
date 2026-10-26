import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";


export class UpdateColumnDto {
    @IsOptional()
    @IsString({ message: 'Title must be a string' })
    title?: string;

    @IsOptional()
    @IsInt({ message: 'Order must be a number' })
    @Min(0, { message: 'Orderr must be ar least 0' })
    @Transform(({ value }) => parseInt(value))
    order?: number;
}