import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";


export class UpdateCommentDto {
    @IsNotEmpty({ message: 'Content is required' })
    @IsString({ message: 'Content must be a string' })
    @MinLength(1, { message: 'Content must be at least 1 characret' })
    @MaxLength(1000, { message: 'Content must be at most 1000 characters' })
    content!: string;
}