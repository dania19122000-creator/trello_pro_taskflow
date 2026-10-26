import { Transform } from "class-transformer";
import { IsArray, IsDateString, IsInt, IsOptional, IsString, Min } from "class-validator";


export class UpdateCardDto {
    @IsOptional()
    @IsString({ message: 'Title must be a string' })
    title?: string;

    @IsOptional()
    @IsString({ message: 'Description must be a string' })
    description?: string;

    @IsOptional()
    @IsInt({ message: 'Order must be a Number' })
    @Min(0, { message: 'Order must be at least 0' })
    @Transform(({ value }) => parseInt(value))
    order?: number;


    @IsOptional()
    @IsInt({ message: 'Column ID must be a number' })
    @Transform(({ value }) => parseInt(value))
    columnId?: number;

    @IsOptional()
    @IsInt({ message: 'Assignee ID must be a number' })
    @Transform(({ value }) => parseInt(value))
    assigneeId?: number;

    @IsOptional()
    @IsDateString({}, { message: 'Due date must be a valid date' })
    dueDate?: string;

    @IsOptional()
    @IsArray({ message: 'LabelIds must be an array' })
    @IsInt({ each: true, message: 'Label IDs must be numbers' })
    labelIds?: number[];
}