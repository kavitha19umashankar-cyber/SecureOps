import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

const s3 = new S3Client({
  region: process.env['AWS_REGION'] ?? 'ap-south-1',
  endpoint: process.env['S3_ENDPOINT'],  // for MinIO in dev
  forcePathStyle: !!process.env['S3_ENDPOINT'],
  credentials: {
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? 'minioadmin',
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? 'minioadmin',
  },
})

const BUCKET = process.env['AWS_S3_BUCKET'] ?? 'secureops-files'

export async function uploadFile(
  tenantId: string,
  folder: string,
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const ext = filename.split('.').pop() ?? 'bin'
  const key = `${tenantId}/${folder}/${randomUUID()}.${ext}`

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )

  return key
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn },
  )
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export function fileUrl(key: string): string {
  const base = process.env['S3_ENDPOINT'] ?? `https://${BUCKET}.s3.amazonaws.com`
  return `${base}/${key}`
}
