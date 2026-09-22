export class LatestRequestGate {
  private generation = 0;

  next() {
    this.generation += 1;
    return this.generation;
  }

  invalidate() {
    this.generation += 1;
  }

  isLatest(requestId: number) {
    return requestId === this.generation;
  }
}
