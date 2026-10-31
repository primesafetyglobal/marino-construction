// The AWS SDK edges swapped for the in-memory fake. Import this file FIRST in
// every Filing test file (vi.mock calls in it are hoisted for that file).
import { vi } from "vitest";

vi.mock("@aws-sdk/client-s3", async (orig) => ({ ...(await orig<typeof import("@aws-sdk/client-s3")>()), S3Client: (await import("./fake-s3")).FakeS3Client }));
vi.mock("@aws-sdk/lib-storage", async () => ({ Upload: (await import("./fake-s3")).FakeUpload }));
vi.mock("@aws-sdk/s3-request-presigner", async () => ({ getSignedUrl: (await import("./fake-s3")).fakeGetSignedUrl }));
