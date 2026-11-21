// Uploads the UI jar and its pom, with their checksums, into a Maven repository with HTTP PUT.
// The address and the credentials come from the environment, never from a file.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { jarSettings, version, jarsFolder, fileBaseNameOf, pathInRepositoryOf } from './jar-coordinates.mjs';

const checksumAlgorithms = [['sha1', 'sha1'], ['md5', 'md5'], ['sha256', 'sha256'], ['sha512', 'sha512']];

export function basicAuthorization(username, password) {
  return username ? { Authorization: 'Basic ' + Buffer.from(`${username}:${password ?? ''}`).toString('base64') } : {};
}

async function putFile(address, content, headers) {
  const answer = await fetch(address, { method: 'PUT', body: content, headers });
  if (!answer.ok) throw new Error(`PUT ${address} answered ${answer.status}`);
}

export async function publishJars({ repositoryUrl, username, password, publishedVersion = version, folder = jarsFolder }) {
  const fileBaseName = fileBaseNameOf(publishedVersion);
  if (!repositoryUrl) throw new Error(`Set ${jarSettings.mavenRepositoryUrlVariable} to the Maven repository to upload into`);
  // A snapshot needs time-stamped file names and its own maven-metadata.xml, which this script does not write.
  if (publishedVersion.endsWith('-SNAPSHOT')) {
    throw new Error(`Version ${publishedVersion} is a snapshot; only release versions are uploaded`);
  }
  const headers = basicAuthorization(username, password);
  const folderAddress = `${repositoryUrl.replace(/\/$/, '')}/${pathInRepositoryOf(publishedVersion)}`;
  const jarAddress = `${folderAddress}/${fileBaseName}.jar`;

  // A release is uploaded once and never overwritten.
  const existing = await fetch(jarAddress, { method: 'HEAD', headers });
  if (existing.ok) throw new Error(`${jarAddress} is already in the repository; a release is never overwritten`);

  for (const extension of ['jar', 'pom']) {
    const name = `${fileBaseName}.${extension}`;
    const content = readFileSync(`${folder}/${name}`);
    await putFile(`${folderAddress}/${name}`, content, headers);
    for (const [suffix, algorithm] of checksumAlgorithms) {
      await putFile(`${folderAddress}/${name}.${suffix}`, createHash(algorithm).update(content).digest('hex'), headers);
    }
  }
  return folderAddress;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folderAddress = await publishJars({
    repositoryUrl: process.env[jarSettings.mavenRepositoryUrlVariable],
    username: process.env[jarSettings.mavenRepositoryUsernameVariable],
    password: process.env[jarSettings.mavenRepositoryPasswordVariable],
  }).catch((failure) => {
    console.error(failure.message);
    process.exit(1);
  });
  console.log(`Uploaded the UI jar to ${folderAddress}`);
}
