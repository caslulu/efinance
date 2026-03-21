import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { InvestmentMarketDataService } from './investment-market-data.service';
import { InvestmentMarketData } from './investment-market-data.types';

describe('InvestmentMarketDataService', () => {
  let service: InvestmentMarketDataService;
  const fetchMock = jest.fn();
  const stockDetailsHtml = `
    <table class="w728">
      <tr>
        <td class="label w15"><span class="txt">Papel</span></td>
        <td class="data w35"><span class="txt">PETR4</span></td>
        <td class="label destaque w2"><span class="txt">Cotação</span></td>
        <td class="data destaque w3"><span class="txt">45,67</span></td>
      </tr>
      <tr>
        <td class="label"><span class="txt">Empresa</span></td>
        <td class="data"><span class="txt">PETROBRAS PN</span></td>
        <td class="label"><span class="txt">Data últ cot</span></td>
        <td class="data"><span class="txt">20/03/2026</span></td>
      </tr>
      <tr>
        <td class="label"><span class="txt">Min 52 sem</span></td>
        <td class="data"><span class="txt">27,53</span></td>
        <td class="label"><span class="txt">Max 52 sem</span></td>
        <td class="data"><span class="txt">47,00</span></td>
      </tr>
      <tr>
        <td class="label w1"><span class="txt">Dia</span></td>
        <td class="data w1"><span class="oscil"><font color="#F75D59">-2,37%</font></span></td>
      </tr>
    </table>
  `;
  const stockHistoryText = JSON.stringify([
    [Date.UTC(2026, 1, 18), 40.0],
    [Date.UTC(2026, 1, 26), 42.0],
    [Date.UTC(2026, 2, 13), 44.0],
    [Date.UTC(2026, 2, 19), 45.67],
  ]);
  const stockDividendsHtml = `
    <table>
      <tbody>
        <tr class="">
          <td>22/12/2025</td>
          <td>0,2964</td>
          <td>DIVIDENDO</td>
          <td>20/03/2026</td>
          <td>1</td>
        </tr>
      </tbody>
    </table>
  `;

  beforeEach(() => {
    service = new InvestmentMarketDataService();
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('should normalize brazilian market data from fundamentus', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/detalhes.php?papel=PETR4')) {
        return {
          ok: true,
          headers: {
            get: () => 'text/html; charset=utf-8',
          },
          arrayBuffer: async () => Buffer.from(stockDetailsHtml),
        };
      }

      if (url.includes('/amline/cot_hist.php?papel=PETR4')) {
        return {
          ok: true,
          headers: {
            get: () => 'text/html; charset=utf-8',
          },
          arrayBuffer: async () => Buffer.from(stockHistoryText),
        };
      }

      if (url.includes('/proventos.php?papel=PETR4&tipo=2')) {
        return {
          ok: true,
          headers: {
            get: () => 'text/html; charset=utf-8',
          },
          arrayBuffer: async () => Buffer.from(stockDividendsHtml),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await service.getMany({
      symbols: ['petr4'],
      periods: [1, 5, 30],
      market: 'BR',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      symbol: 'PETR4',
      marketSymbol: 'PETR4',
      shortName: 'PETROBRAS PN',
      longName: 'PETROBRAS PN',
      currency: 'BRL',
      price: 45.67,
      previousClose: 46.7787,
      dayChange: {
        amount: -1.1087,
        percent: -2.3701,
        direction: 'DOWN',
      },
      latestDividend: {
        amount: 0.2964,
        date: '2026-03-20T20:00:00.000Z',
      },
      priceRange: {
        high52w: 47,
        low52w: 27.53,
      },
    });
    expect(result[0].periodChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          days: 1,
          direction: 'DOWN',
        }),
        expect.objectContaining({
          days: 5,
          direction: 'UP',
        }),
        expect.objectContaining({
          days: 30,
          direction: 'UP',
        }),
      ]),
    );
  });

  it('should throw not found when ticker is missing on details page', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'text/html; charset=utf-8',
      },
      arrayBuffer: async () => Buffer.from('<html><body>sem cotacao</body></html>'),
    });

    await expect(
      service.getMany({
        symbols: ['INVALID1'],
        periods: [1],
        market: 'BR',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should fallback to international market data when ticker is not found in BR', async () => {
    const internationalData: InvestmentMarketData = {
      symbol: 'TSLA',
      marketSymbol: 'TSLA.US',
      shortName: 'Tesla',
      longName: 'Tesla',
      currency: 'USD',
      price: 367.96,
      previousClose: 361.12,
      marketTime: '2026-03-20T20:00:00.000Z',
      dayChange: {
        amount: 6.84,
        percent: 1.894,
        direction: 'UP',
      },
      periodChanges: [],
      latestDividend: null,
      currencyValues: {
        usdBrlRate: null,
        price: {
          brl: null,
          usd: 367.96,
        },
        previousClose: {
          brl: null,
          usd: 361.12,
        },
        latestDividend: null,
      },
      priceRange: {
        high52w: 488.54,
        low52w: 138.8,
      },
    };

    const getUsdBrlRateSpy = jest
      .spyOn(service as any, 'getUsdBrlRate')
      .mockImplementation(async () => null);
    const getBrazilianMarketDataSpy = jest
      .spyOn(service as any, 'getBrazilianMarketData')
      .mockImplementation(async () => {
        throw new NotFoundException('Ticker TSLA não encontrado');
      });
    const getInternationalMarketDataSpy = jest
      .spyOn(service as any, 'getInternationalMarketData')
      .mockImplementation(async () => internationalData);

    const result = await service.getMany({
      symbols: ['tsla'],
      periods: [1, 5],
      market: 'BR',
    });

    expect(result).toEqual([internationalData]);
    expect(getUsdBrlRateSpy).toHaveBeenCalledTimes(1);
    expect(getBrazilianMarketDataSpy).toHaveBeenCalledWith('TSLA', [1, 5], null);
    expect(getInternationalMarketDataSpy).toHaveBeenCalledWith(
      'TSLA',
      [1, 5],
      null,
    );
  });

  it('should throw bad gateway when the provider fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
    });

    await expect(
      service.getMany({
        symbols: ['PETR4'],
        periods: [1],
        market: 'BR',
      }),
    ).rejects.toThrow(BadGatewayException);
  });
});
