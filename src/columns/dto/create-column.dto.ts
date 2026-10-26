import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { Transform } from "class-transformer";


export class CreateColumnDto {
    @IsNotEmpty({ message: 'Title is required' })
    @IsString({ message: 'Title must be a string' })
    title!: string;

    @IsOptional()
    @IsInt({ message: 'Order must be a number' })
    @Min(0, { message: 'Order must be at least 0' })
    @Transform(({ value}) => parseInt(value))
    order?: number;


}