export class WebRTCManager {
  private peerConnection: RTCPeerConnection;

  constructor(configuration?: RTCConfiguration) {
    this.peerConnection = new RTCPeerConnection(configuration);
  }

  public getConnection(): RTCPeerConnection {
    return this.peerConnection;
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  public addLocalStream(stream: MediaStream): void {
    stream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, stream);
    });
  }
}
