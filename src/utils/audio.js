export function reverseAudioBuffer(audioContext, buffer) {
  const reversed = audioContext.createBuffer(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    reversed.copyToChannel(
      buffer.getChannelData(channel).slice().reverse(),
      channel,
    );
  }

  return reversed;
}

export function createWavBlob(
  buffer,
  { mono = false, sampleRate = buffer.sampleRate } = {},
) {
  const channelCount = mono ? 1 : buffer.numberOfChannels;
  const targetSampleRate = Math.min(sampleRate, buffer.sampleRate);
  const frameCount = Math.ceil(
    (buffer.length * targetSampleRate) / buffer.sampleRate,
  );
  const channelData = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  const outputChannels = mono
    ? [channelData]
    : channelData.map((_, index) => [channelData[index]]);
  const audioData = new ArrayBuffer(44 + frameCount * channelCount * 2);
  const view = new DataView(audioData);

  const writeString = (offset, value) =>
    [...value].forEach((character, index) =>
      view.setUint8(offset + index, character.charCodeAt(0)),
    );

  writeString(0, "RIFF");
  view.setUint32(4, audioData.byteLength - 8, true);
  writeString(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, audioData.byteLength - 44, true);

  for (let frame = 0, offset = 44; frame < frameCount; frame++) {
    const sourceFrame = (frame * buffer.sampleRate) / targetSampleRate;
    const lowerFrame = Math.floor(sourceFrame);
    const upperFrame = Math.min(lowerFrame + 1, buffer.length - 1);
    const fraction = sourceFrame - lowerFrame;

    for (let channel = 0; channel < channelCount; channel++) {
      let sample = 0;
      for (const samples of outputChannels[channel]) {
        sample +=
          (samples[lowerFrame] * (1 - fraction) +
            samples[upperFrame] * fraction) /
          outputChannels[channel].length;
      }
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
      offset += 2;
    }
  }

  return new Blob([audioData], { type: "audio/wav" });
}

export function downloadReversedAudio(audioContext, buffer) {
  const reversed = reverseAudioBuffer(audioContext, buffer);
  const url = URL.createObjectURL(createWavBlob(reversed));
  const link = document.createElement("a");

  link.href = url;
  link.download = "voicegame-resultado.wav";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
