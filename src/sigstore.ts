import { Fulcio } from './fulcio';
import { Rekor } from './rekor';
import { Signer, SignedPayload } from './sign';
import { Verifier } from './verify';
import { pae, Envelope } from './dsse';

export interface SigstoreOptions {
  fulcioBaseURL?: string;
  rekorBaseURL?: string;
  oidcIssuer?: string;
  oidcClientID?: string;
  oidcClientSecret?: string;
}

export class Sigstore {
  private signer: Signer;
  private verifier: Verifier;

  constructor(options: SigstoreOptions) {
    const fulcio = new Fulcio({ baseURL: options.fulcioBaseURL });
    const rekor = new Rekor({ baseURL: options.rekorBaseURL });

    this.signer = new Signer({
      fulcio,
      rekor,
      oidcIssuer: options.oidcIssuer,
      oidcClientID: options.oidcClientID,
      oidcClientSecret: options.oidcClientSecret,
    });
    this.verifier = new Verifier({ rekor });
  }

  public async signRaw(
    payload: Buffer,
    identityToken?: string
  ): Promise<SignedPayload> {
    return this.signer.sign(payload, identityToken);
  }

  public async signDSSE(
    payload: Buffer,
    payloadType: string,
    identityToken?: string
  ): Promise<Envelope> {
    const paeBuffer = pae(payloadType, payload);
    const signedPayload = await this.signer.sign(paeBuffer, identityToken);

    const envelope: Envelope = {
      payloadType: payloadType,
      payload: payload.toString('base64'),
      signatures: [
        {
          keyid: '',
          sig: signedPayload.base64Signature,
        },
      ],
    };

    return envelope;
  }

  public async verifyOnline(
    payload: Buffer,
    signature: string
  ): Promise<boolean> {
    return this.verifier.verify(payload, signature);
  }

  public async verifyDSSE(envelope: Envelope): Promise<boolean> {
    const payloadType = envelope.payloadType;
    const payload = Buffer.from(envelope.payload, 'base64');
    const signature = envelope.signatures[0].sig;

    const paeBuffer = pae(payloadType, payload);
    const verified = await this.verifier.verify(paeBuffer, signature);

    return verified;
  }
}
