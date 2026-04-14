import {z} from "zod";

export const PdfSignRequestSchema = z.object({
     SignerID: z.string().min(1, "Signer ID is required").default("SampleSignerID"),
     docID: z.string().min(1, "Document ID is required"),
     is_SigningInfoShown: z.boolean().default(true),
     is_SignatureVisible: z.boolean().default(true),
     height: z.number().positive("Height must be a positive number").default(100),
     width: z.number().positive("Width must be a positive number").default(100),
     offsetX: z.number().nonnegative("Offset X must be a non-negative number").default(0),
     offsetY: z.number().nonnegative("Offset Y must be a non-negative number").default(0),
     page: z.number().positive("Page number must be a positive integer").int().default(1),
     password: z.string("Password must be a string"),
})