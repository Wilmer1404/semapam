(function applyMinimalPolyfills() {
  if (typeof (globalThis as unknown) === 'undefined') {
    (function () {
      if (typeof self !== 'undefined') {
        (self as unknown as Record<string, unknown>).globalThis = self;
      } else if (typeof window !== 'undefined') {
        (window as unknown as Record<string, unknown>).globalThis = window;
      }
    })();
  }

  if (typeof Promise !== 'undefined' && !(Promise as unknown as Record<string, unknown>)['allSettled']) {
    (Promise as unknown as Record<string, unknown>)['allSettled'] = function <T>(
      promises: Iterable<T | PromiseLike<T>>
    ): Promise<Array<{ status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown }>> {
      return Promise.all(
        Array.from(promises).map((p) =>
          Promise.resolve(p)
            .then((value) => ({ status: 'fulfilled' as const, value }))
            .catch((reason) => ({ status: 'rejected' as const, reason }))
        )
      );
    };
  }

  if (!(Array.prototype as unknown as Record<string, unknown>)['at']) {
    (Array.prototype as unknown as Record<string, unknown>)['at'] = function <T>(this: T[], index: number): T | undefined {
      const len = this.length;
      const rel = index < 0 ? len + index : index;
      if (rel < 0 || rel >= len) {
        return undefined;
      }
      return this[rel];
    };
  }

  if (!(Object as unknown as Record<string, unknown>)['hasOwn']) {
    (Object as unknown as Record<string, unknown>)['hasOwn'] = function (
      obj: object,
      prop: PropertyKey
    ): boolean {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    };
  }

  if (!(String.prototype as unknown as Record<string, unknown>)['replaceAll']) {
    const replaceAllImpl = function (
      this: string,
      search: string | RegExp,
      replacement: string
    ): string {
      if (search instanceof RegExp) {
        if (!search.global) {
          throw new TypeError('replaceAll must be called with a global RegExp');
        }
        return this.replace(search, replacement);
      }
      return this.split(search as string).join(replacement);
    };
    (String.prototype as unknown as Record<string, unknown>)['replaceAll'] = replaceAllImpl;
  }
})();
